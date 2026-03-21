/**
 * Round 20.1 — LifeCycleEngine
 *
 * Hybrid Tick/Event driven engine that coordinates lifecycle operations.
 *
 * Architecture Decision AD-2: Reuses HeartbeatDaemon's tick infrastructure
 * by registering a 'lifecycle-tick' phase. Event channel is self-maintained
 * via an internal EventEmitter pattern.
 *
 * Tick path:  HeartbeatDaemon → lifecycle-tick phase → LifeCycleEngine.onTick()
 * Event path: LifeCycleEngine.emit(event) → handler → AgendaArbiter.reprioritize()
 */
import type { HeartbeatDaemon } from './heartbeat.js';
import { AgendaArbiter, type ReprioritizeTrigger } from './agenda-arbiter.js';
import type { TaskAdmissionGate, TaskAdmissionRequest, TaskAdmissionResult } from '../economic/task-admission-gate.js';
import type { EconomicStateService, EconomicProjection } from '../economic/economic-state-service.js';
import type { CommitmentStore } from '../agenda/commitment-store.js';

// ── Lifecycle Event Types ───────────────────────────────────────────

export type LifeCycleEventKind =
  | 'revenue_task_arrived'
  | 'economic_state_changed'
  | 'governance_decision'
  | 'runtime_degraded'
  | 'task_completed'
  | 'task_failed';

export interface LifeCycleEvent {
  /** Event kind */
  readonly kind: LifeCycleEventKind;
  /** Event payload */
  readonly payload: Record<string, unknown>;
  /** ISO timestamp of event creation */
  readonly timestamp: string;
}

// ── Tick Stats ──────────────────────────────────────────────────────

export interface LifeCycleTickStats {
  /** Total tick count */
  readonly tickCount: number;
  /** Total event count */
  readonly eventCount: number;
  /** Total reprioritizations triggered */
  readonly reprioritizeCount: number;
  /** Whether the engine is running */
  readonly running: boolean;
  /** Last tick timestamp */
  readonly lastTickAt: string | null;
}

// ── Event Handler ───────────────────────────────────────────────────

type EventHandler = (event: LifeCycleEvent) => void | Promise<void>;

// ── LifeCycleEngine ─────────────────────────────────────────────────

export class LifeCycleEngine {
  private heartbeat: HeartbeatDaemon;
  private arbiter: AgendaArbiter;
  private admissionGate?: TaskAdmissionGate;
  private economicService?: EconomicStateService;
  private commitmentStore?: CommitmentStore;

  private _running = false;
  private _tickCount = 0;
  private _eventCount = 0;
  private _reprioritizeCount = 0;
  private _lastTickAt: string | null = null;

  // Event handling
  private _handlers = new Map<LifeCycleEventKind, EventHandler[]>();
  private _eventQueue: LifeCycleEvent[] = [];

  // Round 20.3: Legacy deferred tracking (used only when no CommitmentStore)
  private _legacyDeferredTasks: Array<{ taskId: string; deferredAt: string; reason: string }> = [];

  constructor(
    heartbeat: HeartbeatDaemon,
    arbiter: AgendaArbiter,
    admissionGate?: TaskAdmissionGate,
    economicService?: EconomicStateService,
    commitmentStore?: CommitmentStore,
  ) {
    this.heartbeat = heartbeat;
    this.arbiter = arbiter;
    this.admissionGate = admissionGate;
    this.economicService = economicService;
    this.commitmentStore = commitmentStore;

    // Register default event handlers
    this.registerDefaultHandlers();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  /**
   * Start the engine: register the lifecycle-tick phase with HeartbeatDaemon.
   */
  start(): void {
    if (this._running) return;

    this.heartbeat.registerPhase({
      name: 'lifecycle-tick',
      enabled: true,
      execute: async () => this.onTick(),
    });

    this._running = true;
  }

  /**
   * Stop the engine.
   */
  stop(): void {
    this._running = false;
    // HeartbeatDaemon doesn't support unregister, so disable the phase
    this.heartbeat.registerPhase({
      name: 'lifecycle-tick',
      enabled: false,
      execute: async () => {},
    });
  }

  /**
   * Whether the engine is actively tracking.
   */
  get isRunning(): boolean {
    return this._running;
  }

  // ── Tick Handler ──────────────────────────────────────────────────

  /**
   * Called by HeartbeatDaemon on each tick. Executes lifecycle phases:
   * 1. Process queued events
   * 2. Deferred task aging/cleanup
   * 3. Periodic agenda sweep (reprioritize with economic context)
   *
   * Round 20.2: Reads current EconomicProjection and passes it to
   * arbiter.reprioritize() so economic state drives agenda ranking.
   */
  async onTick(): Promise<void> {
    if (!this._running) return;

    this._tickCount++;
    this._lastTickAt = new Date().toISOString();

    // Phase 1: Process any queued events
    await this.processEventQueue();

    // Phase 2: Deferred task aging
    this.deferredAgingCleanup();

    // Phase 3: Economic-aware agenda sweep
    const projection = this.economicService?.getProjection();
    this.arbiter.reprioritize('tick', projection);
    this._reprioritizeCount++;
  }

  // ── Event Channel ─────────────────────────────────────────────────

  /**
   * Emit an event into the lifecycle engine.
   * Events are queued and processed on the next tick, unless
   * the event is marked for immediate processing.
   */
  emit(event: LifeCycleEvent, immediate = false): void {
    this._eventCount++;

    if (immediate) {
      this.dispatchEvent(event);
    } else {
      this._eventQueue.push(event);
    }
  }

  /**
   * Register an event handler for a specific event kind.
   */
  on(kind: LifeCycleEventKind, handler: EventHandler): void {
    const handlers = this._handlers.get(kind) ?? [];
    handlers.push(handler);
    this._handlers.set(kind, handlers);
  }

  // ── Task Admission Integration ────────────────────────────────────

  /**
   * Submit a task for admission. If admitted, it's inserted into the arbiter queue.
   * Returns the admission result.
   */
  submitTask(request: TaskAdmissionRequest): TaskAdmissionResult | null {
    if (!this.admissionGate || !this.economicService) return null;

    const state = this.economicService.snapshot();
    const projection = this.economicService.getProjection();
    const result = this.admissionGate.evaluate(request, state, projection);

    if (result.verdict === 'admit') {
      this.arbiter.insert(result);
    } else if (result.verdict === 'defer') {
      // Round 20.3: Route through CommitmentStore if available
      if (this.commitmentStore) {
        const existing = this.commitmentStore.get(request.taskId);
        if (existing) {
          this.commitmentStore.markDeferred(request.taskId, result.reason);
        }
      }
      this._legacyDeferredTasks.push({
        taskId: request.taskId,
        deferredAt: new Date().toISOString(),
        reason: result.reason,
      });
    }

    return result;
  }

  // ── Deferred Task Management ──────────────────────────────────────

  /**
   * Get all currently deferred tasks.
   * Round 20.3: Queries CommitmentStore if available, falls back to legacy.
   */
  getDeferredTasks(): readonly { taskId: string; deferredAt: string; reason: string }[] {
    if (this.commitmentStore) {
      const deferred = this.commitmentStore.list({ status: ['deferred', 'dormant', 'scheduled'] });
      return deferred.map(c => ({
        taskId: c.id,
        deferredAt: c.lastStateTransitionAt ?? c.updatedAt,
        reason: c.deferredReason ?? c.dormantReason ?? 'scheduled',
      }));
    }
    return [...this._legacyDeferredTasks];
  }

  /**
   * Track a deferred task for aging/cleanup.
   * Round 20.3: Routes through CommitmentStore if available.
   */
  trackDeferred(taskId: string, reason: string): void {
    if (this.commitmentStore) {
      const existing = this.commitmentStore.get(taskId);
      if (existing) {
        this.commitmentStore.markDeferred(taskId, reason);
        return;
      }
    }
    this._legacyDeferredTasks.push({
      taskId,
      deferredAt: new Date().toISOString(),
      reason,
    });
  }

  // ── Diagnostics ───────────────────────────────────────────────────

  /**
   * Get engine statistics.
   */
  stats(): LifeCycleTickStats {
    return {
      tickCount: this._tickCount,
      eventCount: this._eventCount,
      reprioritizeCount: this._reprioritizeCount,
      running: this._running,
      lastTickAt: this._lastTickAt,
    };
  }

  // ── Private ───────────────────────────────────────────────────────

  private async processEventQueue(): Promise<void> {
    const events = [...this._eventQueue];
    this._eventQueue = [];

    for (const event of events) {
      await this.dispatchEvent(event);
    }
  }

  private async dispatchEvent(event: LifeCycleEvent): Promise<void> {
    const handlers = this._handlers.get(event.kind) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch {
        // Log error but don't crash the engine
      }
    }
  }

  /**
   * Age out deferred tasks that have been deferred for too long.
   * Round 20.3: When CommitmentStore is available, checks for expiry-eligible
   * commitments and transitions them. Falls back to legacy cleanup.
   */
  private deferredAgingCleanup(): void {
    if (this.commitmentStore) {
      const now = new Date().toISOString();
      const candidates = this.commitmentStore.list({ status: ['deferred', 'dormant', 'scheduled'] });
      for (const c of candidates) {
        if (c.expiresAt && c.expiresAt <= now) {
          this.commitmentStore.markExpired(c.id);
        }
      }
      return;
    }
    // Legacy: Remove tasks deferred for more than 24 hours
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this._legacyDeferredTasks = this._legacyDeferredTasks.filter(t => {
      return new Date(t.deferredAt).getTime() > cutoff;
    });
  }

  private registerDefaultHandlers(): void {
    // Economic state change → reprioritize
    this.on('economic_state_changed', () => {
      this.arbiter.reprioritize('economic_state_changed');
      this._reprioritizeCount++;
    });

    // Governance decision → reprioritize
    this.on('governance_decision', () => {
      this.arbiter.reprioritize('governance_decision');
      this._reprioritizeCount++;
    });

    // Runtime degraded → emergency reprioritize
    this.on('runtime_degraded', () => {
      this.arbiter.reprioritize('runtime_degraded');
      this._reprioritizeCount++;
    });
  }
}
