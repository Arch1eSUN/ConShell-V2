/**
 * 心跳守护 — 定时任务调度器
 *
 * 内置任务:
 * - 信用监控 (5 min)
 * - 健康检查 (15 min)
 * - 记忆整理 (1 hour)
 * - EvoMap心跳 (10 min)
 */
import type { Logger } from '../types/common.js';
import type { EvoMapClient } from '../evomap/client.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface HeartbeatTask {
  /** 任务名称 */
  name: string;
  /** 执行间隔 (ms) */
  intervalMs: number;
  /** 执行函数 */
  execute: () => Promise<void>;
  /** 是否启用 */
  enabled: boolean;
}

interface RunningTask {
  task: HeartbeatTask;
  timer: ReturnType<typeof setInterval> | null;
  lastRun: string | null;
  runCount: number;
  errorCount: number;
}

// ── HeartbeatDaemon ───────────────────────────────────────────────────

export class HeartbeatDaemon {
  private logger: Logger;
  private tasks = new Map<string, RunningTask>();
  private _running = false;

  constructor(logger: Logger) {
    this.logger = logger.child('heartbeat');
  }

  /** 注册心跳任务 */
  registerTask(task: HeartbeatTask): void {
    this.tasks.set(task.name, {
      task,
      timer: null,
      lastRun: null,
      runCount: 0,
      errorCount: 0,
    });
    this.logger.debug('Task registered', { name: task.name, interval: task.intervalMs });
  }

  /** 注册 EvoMap 心跳任务 */
  registerEvoMapHeartbeat(evomap: EvoMapClient, intervalMs = 10 * 60 * 1000): void {
    this.registerTask({
      name: 'evomap-heartbeat',
      intervalMs,
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

  /** 启动所有已启用的任务 */
  start(): void {
    if (this._running) return;
    this._running = true;

    for (const [name, entry] of this.tasks) {
      if (!entry.task.enabled) continue;

      entry.timer = setInterval(async () => {
        try {
          await entry.task.execute();
          entry.runCount++;
          entry.lastRun = new Date().toISOString();
        } catch (err) {
          entry.errorCount++;
          this.logger.error('Heartbeat task error', { name, error: String(err) });
        }
      }, entry.task.intervalMs);

      this.logger.info('Task started', { name, intervalMs: entry.task.intervalMs });
    }

    this.logger.info('Heartbeat daemon started', { taskCount: this.tasks.size });
  }

  /** 停止所有任务 */
  stop(): void {
    for (const [name, entry] of this.tasks) {
      if (entry.timer) {
        clearInterval(entry.timer);
        entry.timer = null;
        this.logger.debug('Task stopped', { name });
      }
    }
    this._running = false;
    this.logger.info('Heartbeat daemon stopped');
  }

  /** 手动触发指定任务 */
  async runNow(taskName: string): Promise<boolean> {
    const entry = this.tasks.get(taskName);
    if (!entry) return false;

    try {
      await entry.task.execute();
      entry.runCount++;
      entry.lastRun = new Date().toISOString();
      return true;
    } catch (err) {
      entry.errorCount++;
      this.logger.error('Manual task run failed', { name: taskName, error: String(err) });
      return false;
    }
  }

  get running(): boolean {
    return this._running;
  }

  /** 统计 */
  stats(): Array<{
    name: string;
    enabled: boolean;
    intervalMs: number;
    lastRun: string | null;
    runCount: number;
    errorCount: number;
  }> {
    return Array.from(this.tasks.values()).map(e => ({
      name: e.task.name,
      enabled: e.task.enabled,
      intervalMs: e.task.intervalMs,
      lastRun: e.lastRun,
      runCount: e.runCount,
      errorCount: e.errorCount,
    }));
  }
}
