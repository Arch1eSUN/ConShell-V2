/**
 * Round 17.3 — MemorySchedulerBackend
 *
 * Default in-memory implementation of the SchedulerBackend contract.
 * Suitable for single-process runtime; checkpoint/restore via serialize().
 */
import type {
  SchedulerBackend,
  ScheduledTask,
  SchedulerSnapshot,
} from './scheduler-contract.js';

export class MemorySchedulerBackend implements SchedulerBackend {
  private tasks = new Map<string, ScheduledTask>();

  schedule(task: ScheduledTask): void {
    if (this.tasks.has(task.id)) {
      throw new Error(`Scheduled task '${task.id}' already exists`);
    }
    this.tasks.set(task.id, { ...task });
  }

  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'pending') return false;
    this.tasks.delete(taskId);
    return true;
  }

  getDueTasks(now: string): ScheduledTask[] {
    return [...this.tasks.values()].filter(
      t => t.status === 'pending' && t.dueAt <= now,
    );
  }

  getOverdueTasks(now: string): ScheduledTask[] {
    return [...this.tasks.values()].filter(
      t => (t.status === 'pending' || t.status === 'dispatched') && t.dueAt < now,
    );
  }

  markDispatched(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = 'dispatched';
    task.lastAttemptAt = new Date().toISOString();
  }

  markCompleted(taskId: string, result?: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = 'completed';
    task.result = result;
  }

  markFailed(taskId: string, reason: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.retryCount++;
    task.lastAttemptAt = new Date().toISOString();
    if (task.retryCount >= task.maxRetries) {
      task.status = 'failed';
      task.result = reason;
    } else {
      // Reset to pending for retry
      task.status = 'pending';
      task.result = `retry ${task.retryCount}: ${reason}`;
    }
  }

  markSkipped(taskId: string, reason?: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = 'skipped';
    task.result = reason;
  }

  allPending(): ScheduledTask[] {
    return [...this.tasks.values()].filter(t => t.status === 'pending');
  }

  getTask(taskId: string): ScheduledTask | undefined {
    const t = this.tasks.get(taskId);
    return t ? { ...t } : undefined;
  }

  allTasks(): ScheduledTask[] {
    return [...this.tasks.values()];
  }

  serialize(): SchedulerSnapshot {
    const tasks = [...this.tasks.values()];
    const now = new Date().toISOString();
    return {
      tasks,
      snapshotAt: now,
      pendingCount: tasks.filter(t => t.status === 'pending').length,
      overdueCount: 0, // computed by consumer with actual time
    };
  }

  restore(snapshot: SchedulerSnapshot): void {
    this.tasks.clear();
    for (const task of snapshot.tasks) {
      this.tasks.set(task.id, { ...task });
    }
  }

  stats(): { total: number; pending: number; dispatched: number; completed: number; failed: number; skipped: number } {
    const all = [...this.tasks.values()];
    return {
      total: all.length,
      pending: all.filter(t => t.status === 'pending').length,
      dispatched: all.filter(t => t.status === 'dispatched').length,
      completed: all.filter(t => t.status === 'completed').length,
      failed: all.filter(t => t.status === 'failed').length,
      skipped: all.filter(t => t.status === 'skipped').length,
    };
  }
}
