/**
 * Round 17.3 — SchedulerService
 *
 * Runtime layer wrapping the abstract SchedulerBackend.
 * Provides tick-based dispatch, agenda integration, and lifecycle management.
 *
 * tick(now) → getDueTasks → dispatch → callback → mark result
 */
import type { SchedulerBackend, ScheduledTask, SchedulerSnapshot, DispatchResult } from './scheduler-contract.js';
import { createScheduledTask } from './scheduler-contract.js';
import type { AgendaResult } from '../agenda/agenda-generator.js';

// ── Dispatch Handler ─────────────────────────────────────────────────

export type DispatchHandler = (task: ScheduledTask) => DispatchResult | Promise<DispatchResult>;

// ── Tick Result ──────────────────────────────────────────────────────

export interface TickResult {
  /** Timestamp of this tick */
  readonly tickAt: string;
  /** Number of tasks dispatched */
  readonly dispatched: number;
  /** Results from dispatched tasks */
  readonly results: DispatchResult[];
  /** Number of tasks still pending */
  readonly pendingRemaining: number;
  /** Number of overdue tasks */
  readonly overdueCount: number;
}

// ── Scheduler Service ────────────────────────────────────────────────

export class SchedulerService {
  private backend: SchedulerBackend;
  private handler?: DispatchHandler;
  private tickCount = 0;

  constructor(backend: SchedulerBackend, handler?: DispatchHandler) {
    this.backend = backend;
    this.handler = handler;
  }

  /**
   * Set or replace the dispatch handler.
   */
  setHandler(handler: DispatchHandler): void {
    this.handler = handler;
  }

  /**
   * Execute a scheduler tick: find due tasks, dispatch them.
   * This is the heartbeat of the continuous operation loop.
   */
  tick(now?: string): TickResult {
    const tickAt = now ?? new Date().toISOString();
    this.tickCount++;

    const dueTasks = this.backend.getDueTasks(tickAt);
    const results: DispatchResult[] = [];

    for (const task of dueTasks) {
      this.backend.markDispatched(task.id);

      if (this.handler) {
        try {
          const result = this.handler(task);
          if (result instanceof Promise) {
            // Async handler — mark as dispatched, result handled later
            result.then(r => {
              if (r.success) {
                this.backend.markCompleted(task.id, r.result);
              } else {
                this.backend.markFailed(task.id, r.error ?? 'unknown error');
              }
            }).catch(err => {
              this.backend.markFailed(task.id, String(err));
            });
            results.push({ taskId: task.id, success: true, result: 'async-dispatched' });
          } else {
            // Sync handler
            if (result.success) {
              this.backend.markCompleted(task.id, result.result);
            } else {
              this.backend.markFailed(task.id, result.error ?? 'unknown error');
            }
            results.push(result);
          }
        } catch (err) {
          this.backend.markFailed(task.id, String(err));
          results.push({ taskId: task.id, success: false, error: String(err) });
        }
      } else {
        // No handler — mark completed as no-op
        this.backend.markCompleted(task.id, 'no-handler');
        results.push({ taskId: task.id, success: true, result: 'no-handler' });
      }
    }

    return {
      tickAt,
      dispatched: results.length,
      results,
      pendingRemaining: this.backend.allPending().length,
      overdueCount: this.backend.getOverdueTasks(tickAt).length,
    };
  }

  /**
   * Convert an agenda result into scheduled tasks.
   * Each selected agenda item becomes a scheduled task.
   */
  scheduleFromAgenda(agenda: AgendaResult): ScheduledTask[] {
    const tasks: ScheduledTask[] = [];
    for (const item of agenda.selected) {
      const c = item.commitment;
      const task = createScheduledTask({
        commitmentId: c.id,
        taskType: c.taskType,
        description: c.name,
        dueAt: c.dueAt ?? new Date().toISOString(),
        maxRetries: 3,
      });
      this.backend.schedule(task);
      tasks.push(task);
    }
    return tasks;
  }

  /**
   * Get current scheduler snapshot (for checkpoint).
   */
  snapshot(): SchedulerSnapshot {
    return this.backend.serialize();
  }

  /**
   * Restore from checkpoint snapshot.
   */
  restore(snapshot: SchedulerSnapshot): void {
    this.backend.restore(snapshot);
  }

  /**
   * Get scheduler statistics.
   */
  stats() {
    return {
      ...this.backend.stats(),
      tickCount: this.tickCount,
    };
  }

  /**
   * Get all pending tasks.
   */
  pendingTasks(): ScheduledTask[] {
    return this.backend.allPending();
  }

  /**
   * Get overdue tasks at a given time.
   */
  overdueTasks(now?: string): ScheduledTask[] {
    return this.backend.getOverdueTasks(now ?? new Date().toISOString());
  }

  /**
   * Get the underlying backend (for advanced operations).
   */
  getBackend(): SchedulerBackend {
    return this.backend;
  }
}
