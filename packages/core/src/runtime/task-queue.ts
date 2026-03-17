/**
 * 异步任务队列 — 并发控制 + 重试策略 + 经济路由
 *
 * Round 15.8: Consumes EconomicStateService to route tasks based on value.
 */
import type { Logger } from '../types/common.js';
import type { EconomicStateService } from '../economic/economic-state-service.js';
import type { EconomicPolicy, DecisionRecord, RuntimeMode } from '../economic/economic-policy.js';
import { resolveRuntimeMode } from '../economic/economic-policy.js';
import type { ValueEventRecorder } from '../economic/value-event-recorder.js';
import type { TaskFeedbackHeuristic } from '../economic/task-feedback-heuristic.js';
import type { TaskCompletionEvent } from '../economic/value-events.js';
import type { EconomicMemoryStore } from '../economic/economic-memory-store.js';
import type { ValueLifecycleTracker } from '../economic/value-lifecycle-tracker.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface QueuedTask<T = unknown> {
  id: string;
  name: string;
  execute: () => Promise<T>;
  retries?: number;
  priority?: number;
  /** Whether this task generates revenue (for economic routing) */
  isRevenueBearing?: boolean;
  /** Task type for cost estimation */
  taskType?: 'inference' | 'tool_call' | 'browser' | 'media' | 'composite';
  /** Estimated complexity (1-10, default 5) */
  complexity?: number;
}

export interface TaskResult<T = unknown> {
  id: string;
  name: string;
  success: boolean;
  result?: T;
  error?: string;
  attempts: number;
  durationMs: number;
}

export interface TaskQueueOptions {
  /** 最大并发数, 默认 3 */
  concurrency?: number;
  /** 最大重试次数, 默认 2 */
  maxRetries?: number;
  /** 重试延迟(ms), 默认 1000 */
  retryDelayMs?: number;
}

// ── TaskQueue ─────────────────────────────────────────────────────────

export class TaskQueue {
  private logger: Logger;
  private opts: Required<TaskQueueOptions>;
  private queue: QueuedTask[] = [];
  private running = 0;
  private results: TaskResult[] = [];
  private _processing = false;
  private _economicService?: EconomicStateService;
  private _economicPolicy?: EconomicPolicy;
  private _valueRecorder?: ValueEventRecorder;
  private _feedbackHeuristic?: TaskFeedbackHeuristic;
  private _memoryStore?: EconomicMemoryStore;
  private _lifecycleTracker?: ValueLifecycleTracker;
  private _rejectedCount = 0;

  constructor(logger: Logger, opts?: TaskQueueOptions) {
    this.logger = logger.child('task-queue');
    this.opts = {
      concurrency: opts?.concurrency ?? 3,
      maxRetries: opts?.maxRetries ?? 2,
      retryDelayMs: opts?.retryDelayMs ?? 1000,
    };
  }

  /** Inject EconomicStateService for value-aware routing */
  setEconomicService(service: EconomicStateService, policy?: EconomicPolicy): void {
    this._economicService = service;
    this._economicPolicy = policy;
    this.logger.info('Economic routing enabled for TaskQueue');
  }

  /** Inject ValueEventRecorder for feedback loop (Round 15.9) */
  setValueRecorder(recorder: ValueEventRecorder): void {
    this._valueRecorder = recorder;
    this.logger.info('Value event recording enabled for TaskQueue');
  }

  /** Inject TaskFeedbackHeuristic for priority adjustment (Round 15.9) */
  setFeedbackHeuristic(heuristic: TaskFeedbackHeuristic): void {
    this._feedbackHeuristic = heuristic;
    this.logger.info('Feedback heuristic enabled for TaskQueue');
  }

  /** Inject EconomicMemoryStore for long-term memory (Round 16.0) */
  setMemoryStore(store: EconomicMemoryStore): void {
    this._memoryStore = store;
    this.logger.info('Economic memory store enabled for TaskQueue');
  }

  /** Inject ValueLifecycleTracker for lifecycle tracking (Round 16.0) */
  setLifecycleTracker(tracker: ValueLifecycleTracker): void {
    this._lifecycleTracker = tracker;
    this.logger.info('Value lifecycle tracker enabled for TaskQueue');
  }

  /** 入队任务 — with economic routing + mode + feedback */
  enqueue<T>(task: QueuedTask<T>): boolean {
    // RuntimeMode behavior contract (Round 15.9)
    if (this._economicService) {
      const snap = this._economicService.snapshot();
      const mode = resolveRuntimeMode(snap.survivalTier);

      if (mode === 'shutdown') {
        this._rejectedCount++;
        this.logger.info('Task rejected: shutdown mode', { id: task.id, name: task.name });
        this.results.push({
          id: task.id, name: task.name, success: false,
          error: 'Rejected: agent in shutdown mode', attempts: 0, durationMs: 0,
        });
        return false;
      }

      if (mode === 'survival-recovery' && !(task.isRevenueBearing)) {
        this._rejectedCount++;
        this.logger.info('Task rejected: survival-recovery mode, non-revenue', { id: task.id });
        this.results.push({
          id: task.id, name: task.name, success: false,
          error: 'Rejected: survival-recovery mode — only revenue tasks accepted', attempts: 0, durationMs: 0,
        });
        return false;
      }

      // revenue-seeking mode: priority bonus/penalty
      if (mode === 'revenue-seeking') {
        const bonus = task.isRevenueBearing ? 20 : -20;
        task = { ...task, priority: (task.priority ?? 0) + bonus } as QueuedTask<T>;
      }
    }

    // Economic routing: evaluate task before enqueueing
    if (this._economicService) {
      const routing = this._economicService.getTaskRouting({
        id: task.id,
        type: task.taskType ?? 'inference',
        complexity: task.complexity ?? 5,
        isRevenueBearing: task.isRevenueBearing ?? false,
        expectedRevenueCents: 0,
      });

      // Record the decision in audit trail
      if (this._economicPolicy) {
        const snap = this._economicService.snapshot();
        const mode = resolveRuntimeMode(snap.survivalTier);
        this._economicPolicy.record({
          timestamp: new Date().toISOString(),
          component: 'task-queue',
          actionType: 'enqueue',
          decision: routing.action === 'accept' ? 'allow'
            : routing.action === 'reject' ? 'block'
            : 'reprioritize',
          reason: routing.reason,
          tier: snap.survivalTier,
          mode,
          context: `task:${task.id} name:${task.name} revenue:${task.isRevenueBearing ?? false}`,
        });
      }

      if (routing.action === 'reject') {
        this._rejectedCount++;
        this.logger.info('Task rejected by economic routing', {
          id: task.id, name: task.name, reason: routing.reason,
        });
        this.results.push({
          id: task.id,
          name: task.name,
          success: false,
          error: `Rejected by economic routing: ${routing.reason}`,
          attempts: 0,
          durationMs: 0,
        });
        return false;
      }

      // Apply routing priority override
      if (routing.priority !== undefined) {
        task = { ...task, priority: routing.priority } as QueuedTask<T>;
      }
    }

    // Feedback heuristic: adjust priority based on historical outcomes (Round 15.9/16.0)
    if (this._feedbackHeuristic) {
      // Round 16.0: use mode-sensitive adjustment if memory store is wired
      const currentMode = this._economicService
        ? resolveRuntimeMode(this._economicService.snapshot().survivalTier)
        : 'normal' as RuntimeMode;
      const adjustment = this._feedbackHeuristic.getPriorityAdjustmentForMode
        ? this._feedbackHeuristic.getPriorityAdjustmentForMode(
            task.taskType ?? 'general', task.name,
            task.isRevenueBearing ?? false, currentMode,
          )
        : this._feedbackHeuristic.getPriorityAdjustment(
            task.name, task.isRevenueBearing ?? false,
          );
      if (adjustment !== 0) {
        task = { ...task, priority: (task.priority ?? 0) + adjustment } as QueuedTask<T>;
        this.logger.debug('Feedback priority adjustment', { name: task.name, adjustment });
      }
    }

    // Round 16.0: Register task in lifecycle tracker
    if (this._lifecycleTracker) {
      this._lifecycleTracker.plan(
        task.id, task.name, task.taskType ?? 'general',
        task.isRevenueBearing ?? false,
      );
    }

    this.queue.push(task as QueuedTask);
    this.queue.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    this.logger.debug('Task enqueued', {
      id: task.id, name: task.name, priority: task.priority, queueSize: this.queue.length,
    });
    this.processNext();
    return true;
  }

  /** Number of tasks rejected by economic routing */
  get rejectedCount(): number {
    return this._rejectedCount;
  }

  /** 获取所有结果 */
  getResults(): readonly TaskResult[] {
    return this.results;
  }

  /** 获取队列长度 */
  get size(): number {
    return this.queue.length;
  }

  /** 获取当前并行运行数 */
  get activeCount(): number {
    return this.running;
  }

  /** 等待所有任务完成 */
  async drain(): Promise<TaskResult[]> {
    while (this.queue.length > 0 || this.running > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return [...this.results];
  }

  /** 清空队列 */
  clear(): void {
    this.queue = [];
    this.logger.debug('Queue cleared');
  }

  // ── Internal ──────────────────────────────────────────────────────

  private processNext(): void {
    while (this.running < this.opts.concurrency && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.running++;
      this.executeWithRetry(task).finally(() => {
        this.running--;
        this.processNext();
      });
    }
  }

  private async executeWithRetry(task: QueuedTask): Promise<void> {
    const maxAttempts = (task.retries ?? this.opts.maxRetries) + 1;
    let lastError = '';
    const taskStartTime = Date.now();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const startTime = Date.now();

      try {
        const result = await task.execute();
        const durationMs = Date.now() - startTime;
        this.results.push({
          id: task.id,
          name: task.name,
          success: true,
          result,
          attempts: attempt,
          durationMs,
        });
        this.logger.debug('Task completed', { id: task.id, attempt });

        // Round 15.9: Emit TaskCompletionEvent for feedback loop
        this.emitCompletionEvent(task, true, durationMs);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        this.logger.warn('Task attempt failed', { id: task.id, attempt, error: lastError });

        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.opts.retryDelayMs * attempt)); // exponential-ish
        }
      }
    }

    // All retries exhausted
    const totalDuration = Date.now() - taskStartTime;
    this.results.push({
      id: task.id,
      name: task.name,
      success: false,
      error: lastError,
      attempts: maxAttempts,
      durationMs: totalDuration,
    });

    // Round 15.9: Emit failure event for feedback loop
    this.emitCompletionEvent(task, false, totalDuration);
  }

  /** Round 15.9/16.0: Emit TaskCompletionEvent → Recorder + Heuristic + Memory + Lifecycle */
  private emitCompletionEvent(task: QueuedTask, success: boolean, _durationMs: number): void {
    const event: TaskCompletionEvent = {
      type: 'task_completion',
      taskId: task.id,
      taskName: task.name,
      success,
      actualCostCents: (task.complexity ?? 5) * 2, // estimate: complexity × 2 cents
      revenueGenerated: success && (task.isRevenueBearing ?? false),
      netValueCents: success && task.isRevenueBearing
        ? Math.max(0, 10 - (task.complexity ?? 5) * 2) // simplified net value
        : -((task.complexity ?? 5) * 2),
      timestamp: new Date().toISOString(),
    };

    if (this._valueRecorder) {
      this._valueRecorder.record(event);
    }
    if (this._feedbackHeuristic) {
      this._feedbackHeuristic.ingest(event);
    }

    // Round 16.0: Forward to EconomicMemoryStore
    if (this._memoryStore && this._economicService) {
      const mode = resolveRuntimeMode(this._economicService.snapshot().survivalTier);
      this._memoryStore.ingest(event, {
        taskType: task.taskType ?? 'general',
        taskName: task.name,
        mode,
      });
    }

    // Round 16.0: Advance lifecycle to 'completed'
    if (this._lifecycleTracker) {
      this._lifecycleTracker.advance(task.id, 'completed');
      // Non-revenue tasks go straight to 'retained'
      if (!(task.isRevenueBearing)) {
        this._lifecycleTracker.advance(task.id, 'retained');
      }
    }
  }
}
