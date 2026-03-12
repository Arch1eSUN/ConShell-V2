/**
 * 异步任务队列 — 并发控制 + 重试策略
 */
import type { Logger } from '../types/common.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface QueuedTask<T = unknown> {
  id: string;
  name: string;
  execute: () => Promise<T>;
  retries?: number;
  priority?: number;
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

  constructor(logger: Logger, opts?: TaskQueueOptions) {
    this.logger = logger.child('task-queue');
    this.opts = {
      concurrency: opts?.concurrency ?? 3,
      maxRetries: opts?.maxRetries ?? 2,
      retryDelayMs: opts?.retryDelayMs ?? 1000,
    };
  }

  /** 入队任务 */
  enqueue<T>(task: QueuedTask<T>): void {
    this.queue.push(task as QueuedTask);
    this.queue.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)); // 高优先级先执行
    this.logger.debug('Task enqueued', { id: task.id, name: task.name, queueSize: this.queue.length });
    this.processNext();
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

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const startTime = Date.now();

      try {
        const result = await task.execute();
        this.results.push({
          id: task.id,
          name: task.name,
          success: true,
          result,
          attempts: attempt,
          durationMs: Date.now() - startTime,
        });
        this.logger.debug('Task completed', { id: task.id, attempt });
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
    this.results.push({
      id: task.id,
      name: task.name,
      success: false,
      error: lastError,
      attempts: maxAttempts,
      durationMs: 0,
    });
  }
}
