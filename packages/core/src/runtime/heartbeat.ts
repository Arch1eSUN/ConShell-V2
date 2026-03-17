/**
 * HeartbeatDaemon — tick-based unified scheduler.
 *
 * Refactored from interval-per-task to a single tick loop that
 * executes registered phases sequentially:
 *   health-check → economic-refresh → commitment-review
 *
 * Each tick runs all enabled phases in order. This ensures
 * deterministic execution order and simplifies testing.
 */
import type { Logger } from '../types/common.js';
import type { EvoMapClient } from '../evomap/client.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface TickPhase {
  /** Phase name (must be unique) */
  name: string;
  /** Phase execution function */
  execute: () => Promise<void>;
  /** Is phase enabled? */
  enabled: boolean;
}

interface PhaseStats {
  name: string;
  enabled: boolean;
  lastRun: string | null;
  runCount: number;
  errorCount: number;
}

// ── HeartbeatDaemon ───────────────────────────────────────────────────

export class HeartbeatDaemon {
  private logger: Logger;
  private phases: TickPhase[] = [];
  private phaseStats = new Map<string, { lastRun: string | null; runCount: number; errorCount: number }>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private _running = false;
  private _tickIntervalMs: number;
  private _tickCount = 0;

  constructor(logger: Logger, tickIntervalMs = 2 * 60 * 1000) {
    this.logger = logger.child('heartbeat');
    this._tickIntervalMs = tickIntervalMs;
  }

  // ── Phase management ────────────────────────────────────────────────

  /** Register a tick phase (executed in registration order) */
  registerPhase(phase: TickPhase): void {
    // Replace if already registered
    const existing = this.phases.findIndex(p => p.name === phase.name);
    if (existing >= 0) {
      this.phases[existing] = phase;
    } else {
      this.phases.push(phase);
    }
    if (!this.phaseStats.has(phase.name)) {
      this.phaseStats.set(phase.name, { lastRun: null, runCount: 0, errorCount: 0 });
    }
    this.logger.debug('Phase registered', { name: phase.name });
  }

  /** Register EvoMap heartbeat as a phase */
  registerEvoMapHeartbeat(evomap: EvoMapClient, _intervalMs?: number): void {
    this.registerPhase({
      name: 'evomap-heartbeat',
      enabled: true,
      execute: async () => {
        try {
          await evomap.heartbeat();
        } catch (err) {
          this.logger.warn('EvoMap heartbeat failed', { error: String(err) });
        }
      },
    });
  }

  // ── Legacy compatibility: register old-style HeartbeatTask as a phase ─

  registerTask(task: { name: string; intervalMs: number; execute: () => Promise<void>; enabled: boolean }): void {
    this.registerPhase({
      name: task.name,
      enabled: task.enabled,
      execute: task.execute,
    });
  }

  // ── Tick execution ──────────────────────────────────────────────────

  /** Execute one tick: run all enabled phases sequentially */
  async tick(): Promise<void> {
    this._tickCount++;

    for (const phase of this.phases) {
      if (!phase.enabled) continue;

      const stats = this.phaseStats.get(phase.name)!;
      try {
        await phase.execute();
        stats.runCount++;
        stats.lastRun = new Date().toISOString();
      } catch (err) {
        stats.errorCount++;
        this.logger.error('Tick phase error', { phase: phase.name, error: String(err) });
      }
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  /** Start the tick loop */
  start(): void {
    if (this._running) return;
    this._running = true;

    this.tickTimer = setInterval(async () => {
      await this.tick();
    }, this._tickIntervalMs);

    this.logger.info('Heartbeat daemon started (tick-based)', {
      phaseCount: this.phases.length,
      intervalMs: this._tickIntervalMs,
    });
  }

  /** Stop the tick loop */
  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this._running = false;
    this.logger.info('Heartbeat daemon stopped');
  }

  /** Manually trigger a specific phase (or all if no name given) */
  async runNow(phaseName?: string): Promise<boolean> {
    if (phaseName) {
      const phase = this.phases.find(p => p.name === phaseName);
      if (!phase) return false;

      const stats = this.phaseStats.get(phase.name)!;
      try {
        await phase.execute();
        stats.runCount++;
        stats.lastRun = new Date().toISOString();
        return true;
      } catch (err) {
        stats.errorCount++;
        this.logger.error('Manual phase run failed', { name: phaseName, error: String(err) });
        return false;
      }
    }

    // Run full tick
    await this.tick();
    return true;
  }

  // ── Diagnostics ─────────────────────────────────────────────────────

  get running(): boolean {
    return this._running;
  }

  get tickCount(): number {
    return this._tickCount;
  }

  get tickIntervalMs(): number {
    return this._tickIntervalMs;
  }

  stats(): PhaseStats[] {
    return this.phases.map(phase => {
      const s = this.phaseStats.get(phase.name)!;
      return {
        name: phase.name,
        enabled: phase.enabled,
        lastRun: s.lastRun,
        runCount: s.runCount,
        errorCount: s.errorCount,
      };
    });
  }
}
