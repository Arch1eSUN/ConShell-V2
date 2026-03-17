/**
 * Round 17.3 — Scheduler Contract (Abstract)
 *
 * Defines the abstract SchedulerBackend interface and ScheduledTask model.
 * Concrete implementations (in-memory, SQLite, etc.) implement this contract.
 *
 * Design: abstract contract first, in-memory as default implementation.
 */

// ── Scheduled Task ───────────────────────────────────────────────────

export type ScheduledTaskStatus = 'pending' | 'dispatched' | 'completed' | 'failed' | 'skipped';

export interface ScheduledTask {
  /** Unique task ID */
  readonly id: string;
  /** Linked commitment ID */
  readonly commitmentId: string;
  /** Task type for dispatch routing */
  readonly taskType: string;
  /** Human-readable description */
  readonly description?: string;
  /** ISO-8601 due time */
  readonly dueAt: string;
  /** Current status */
  status: ScheduledTaskStatus;
  /** Number of dispatch attempts */
  retryCount: number;
  /** Maximum retries before marking failed */
  readonly maxRetries: number;
  /** ISO-8601 creation time */
  readonly createdAt: string;
  /** ISO-8601 last dispatch attempt */
  lastAttemptAt?: string;
  /** Result from execution (if completed/failed) */
  result?: string;
}

// ── Scheduler Snapshot (for checkpoint/recovery) ─────────────────────

export interface SchedulerSnapshot {
  /** All tasks in the scheduler */
  readonly tasks: ScheduledTask[];
  /** Timestamp of snapshot creation */
  readonly snapshotAt: string;
  /** Number of pending tasks */
  readonly pendingCount: number;
  /** Number of overdue tasks */
  readonly overdueCount: number;
}

// ── Dispatch Result ──────────────────────────────────────────────────

export interface DispatchResult {
  readonly taskId: string;
  readonly success: boolean;
  readonly result?: string;
  readonly error?: string;
}

// ── Abstract Scheduler Backend ───────────────────────────────────────

export interface SchedulerBackend {
  /**
   * Schedule a new task for future execution.
   */
  schedule(task: ScheduledTask): void;

  /**
   * Cancel a pending task. Returns true if found and cancelled.
   */
  cancel(taskId: string): boolean;

  /**
   * Get all tasks that are due (dueAt <= now) and still pending.
   */
  getDueTasks(now: string): ScheduledTask[];

  /**
   * Get all overdue tasks (due but not yet dispatched/completed).
   */
  getOverdueTasks(now: string): ScheduledTask[];

  /**
   * Mark a task as dispatched (being executed).
   */
  markDispatched(taskId: string): void;

  /**
   * Mark a task as completed with optional result.
   */
  markCompleted(taskId: string, result?: string): void;

  /**
   * Mark a task as failed with reason.
   * Increments retryCount; if maxRetries exceeded, status stays 'failed'.
   * Otherwise, resets to 'pending' for retry.
   */
  markFailed(taskId: string, reason: string): void;

  /**
   * Mark a task as skipped (intentionally not executed).
   */
  markSkipped(taskId: string, reason?: string): void;

  /**
   * Get all pending tasks.
   */
  allPending(): ScheduledTask[];

  /**
   * Get a task by ID.
   */
  getTask(taskId: string): ScheduledTask | undefined;

  /**
   * Get all tasks (any status).
   */
  allTasks(): ScheduledTask[];

  /**
   * Serialize current state for checkpoint.
   */
  serialize(): SchedulerSnapshot;

  /**
   * Restore state from a checkpoint snapshot.
   */
  restore(snapshot: SchedulerSnapshot): void;

  /**
   * Get scheduler statistics.
   */
  stats(): {
    total: number;
    pending: number;
    dispatched: number;
    completed: number;
    failed: number;
    skipped: number;
  };
}

// ── Factory Helper ───────────────────────────────────────────────────

let _taskIdCounter = 0;

export interface CreateScheduledTaskInput {
  commitmentId: string;
  taskType: string;
  description?: string;
  dueAt: string;
  maxRetries?: number;
}

export function createScheduledTask(input: CreateScheduledTaskInput): ScheduledTask {
  return {
    id: `schtask_${Date.now()}_${++_taskIdCounter}`,
    commitmentId: input.commitmentId,
    taskType: input.taskType,
    description: input.description,
    dueAt: input.dueAt,
    status: 'pending',
    retryCount: 0,
    maxRetries: input.maxRetries ?? 3,
    createdAt: new Date().toISOString(),
    lastAttemptAt: undefined,
    result: undefined,
  };
}
