/**
 * Kernel — ConShell V2 引导核心
 *
 * 11步启动序列：
 *   1. initLogger       → 结构化日志
 *   2. loadConfig       → 混合配置 (file + env)
 *   3. initDatabase     → SQLite + WAL + 迁移
 *   4. loadWallet       → 加载/创建以太坊钱包
 *   5. loadSoul         → SOUL.md 解析/创建
 *   6. initMemory       → 3层记忆管理
 *   7. initModels       → Provider注册 + InferenceRouter
 *   8. initAutomaton    → 状态机 + AgentLoop + 工具
 *   9. initSkills       → 技能扫描 + 注册
 *  10. initServer       → HTTP/WS + 路由 + 中间件 + CLIProxy
 *  11. startHeartbeat   → 心跳守护 + 定时任务
 *
 * Provider factory and server init are in separate sub-modules
 * to keep this file focused on orchestration.
 */
import type { Logger } from '../types/common.js';
import type { AppConfig } from '../types/config.js';
import { InferenceRouter } from '../inference/index.js';
import { MemoryTierManager } from '../memory/tier-manager.js';
import { SoulSystem } from '../soul/system.js';
import { SkillRegistry } from '../skills/registry.js';
import { AgentStateMachine } from '../runtime/state-machine.js';
import { AgentLoop } from '../runtime/agent-loop.js';
import { ToolExecutor } from '../runtime/tool-executor.js';
import { HeartbeatDaemon } from '../runtime/heartbeat.js';
import { TaskQueue } from '../runtime/task-queue.js';
import { HttpServer } from '../server/http.js';
import { WebSocketServer } from '../server/websocket.js';
import type { EvoMapClient } from '../evomap/client.js';

// Sub-modules
import { registerProviders } from './provider-factory.js';
import { initServer } from './server-init.js';

// ── Types ─────────────────────────────────────────────────────────────

export type BootStage =
  | 'logger'
  | 'config'
  | 'database'
  | 'wallet'
  | 'soul'
  | 'memory'
  | 'models'
  | 'automaton'
  | 'skills'
  | 'server'
  | 'heartbeat';

export interface BootStageResult {
  stage: BootStage;
  ok: boolean;
  durationMs: number;
  error?: string;
}

/** 运行中的全部服务引用 */
export interface KernelServices {
  logger: Logger;
  config: AppConfig;
  db: any; // better-sqlite3 Database
  wallet: { address: string; chainId: number } | null;
  soul: SoulSystem;
  memory: MemoryTierManager;
  inference: InferenceRouter;
  stateMachine: AgentStateMachine;
  agentLoop: AgentLoop;
  toolExecutor: ToolExecutor;
  skills: SkillRegistry;
  heartbeat: HeartbeatDaemon;
  taskQueue: TaskQueue;
  httpServer: HttpServer;
  wsServer: WebSocketServer;
  evomap: EvoMapClient | null;
}

export interface BootResult {
  ok: boolean;
  stages: BootStageResult[];
  services: KernelServices | null;
  totalMs: number;
  failedAt?: BootStage;
}

// Re-export sub-modules
export { registerProviders } from './provider-factory.js';
export { initServer } from './server-init.js';

// ── Helper ────────────────────────────────────────────────────────────

function cfgGet<T>(config: AppConfig, key: string, fallback: T): T {
  return (config as any)[key] ?? fallback;
}

// ── Kernel ─────────────────────────────────────────────────────────────

export class Kernel {
  private services: KernelServices | null = null;
  private stages: BootStageResult[] = [];
  private _running = false;

  /** 是否运行中 */
  get running(): boolean { return this._running; }

  /** 获取服务实例 (仅启动后可用) */
  get svc(): KernelServices {
    if (!this.services) throw new Error('Kernel not booted');
    return this.services;
  }

  /** 获取启动结果 */
  get bootStages(): readonly BootStageResult[] {
    return this.stages;
  }

  /**
   * 完整启动序列
   */
  async boot(configOverrides?: Partial<AppConfig>): Promise<BootResult> {
    const totalStart = Date.now();
    this.stages = [];

    try {
      // ── Step 1: Logger ──────────────────────────────────────────────
      const logger = await this.runStage('logger', async () => {
        const mod = await import('../logger/index.js');
        return mod.createLogger(configOverrides?.logLevel ?? 'info');
      });

      logger.info('🐢 ConShell V2 booting…');

      // ── Step 2: Config ──────────────────────────────────────────────
      const config = await this.runStage('config', async () => {
        const mod = await import('../config/index.js');
        const base = await mod.loadConfig();
        if (configOverrides) Object.assign(base, configOverrides);
        return base;
      });

      logger.info('Config loaded', { agent: config.agentName, mode: config.inferenceMode });

      // ── Step 3: Database ────────────────────────────────────────────
      const agentHome: string = cfgGet(config, 'agentHome',
        process.env['CONSHELL_HOME'] ?? `${process.env['HOME'] ?? '.'}/.conshell`,
      );

      const db = await this.runStage('database', async () => {
        const { openDatabase } = await import('../state/index.js');
        return openDatabase({ agentHome, logger });
      });

      logger.info('Database ready');

      // ── Step 4: Wallet ──────────────────────────────────────────────
      const walletDir = `${agentHome}/wallet`;
      const wallet = await this.runStage('wallet', async () => {
        if (!cfgGet<boolean>(config, 'walletEnabled', true)) return null;
        try {
          const mod = await import('../wallet/index.js');
          const account = mod.loadOrGenerateWallet(walletDir);
          if (!account?.address) return null;
          return { address: account.address, chainId: 8453 };
        } catch (err) {
          logger.warn('Wallet load failed, proceeding without', { error: String(err) });
          return null;
        }
      });

      if (wallet) logger.info('Wallet loaded', { address: wallet.address });

      // ── Step 5: Soul ────────────────────────────────────────────────
      const soul = await this.runStage('soul', async () => {
        const s = new SoulSystem(db, logger);
        s.load();
        return s;
      });

      logger.info('Soul loaded', { name: soul.current.name });

      // ── Step 6: Memory ──────────────────────────────────────────────
      const memory = await this.runStage('memory', async () => {
        return new MemoryTierManager(db, logger);
      });

      logger.info('Memory initialized');

      // ── Step 7: Models / Inference ──────────────────────────────────
      const inference = await this.runStage('models', async () => {
        const router = new InferenceRouter(logger);
        const providerConfigs = cfgGet<any[]>(config, 'providers', []);
        await registerProviders(router, providerConfigs, logger);
        return router;
      });

      logger.info('Inference ready', { providers: inference.stats().providerCount });

      // ── Step 8: Automaton (StateMachine + AgentLoop + Tools) ─────────
      const automaton = await this.runStage('automaton', async () => {
        const stateMachine = new AgentStateMachine(logger);
        const toolExecutor = new ToolExecutor(logger);
        const taskQueue = new TaskQueue(logger);

        const { allBuiltinTools } = await import('../runtime/tools/index.js');
        toolExecutor.registerTools(allBuiltinTools);

        const defaultModel = cfgGet<string>(config, 'model', 'gpt-4o');
        const agentLoop = new AgentLoop(
          inference, toolExecutor, memory, soul, logger,
          { defaultModel },
        );

        return { stateMachine, toolExecutor, agentLoop, taskQueue };
      });

      logger.info('Automaton ready', {
        tools: automaton.toolExecutor.stats().registeredTools,
      });

      // ── Step 9: Skills ──────────────────────────────────────────────
      const skills = await this.runStage('skills', async () => {
        const registry = new SkillRegistry(db, logger);
        registry.initialize();
        return registry;
      });

      logger.info('Skills loaded', { count: skills.stats().total });

      // ── Step 10: Server ─────────────────────────────────────────────
      const server = await this.runStage('server', async () => {
        return initServer({
          config, logger, inference,
          stateMachine: automaton.stateMachine,
          agentLoop: automaton.agentLoop,
          toolExecutor: automaton.toolExecutor,
          skills, memory, db,
        });
      });

      // ── Step 11: Heartbeat ──────────────────────────────────────────
      let evomap: EvoMapClient | null = null;

      const heartbeat = await this.runStage('heartbeat', async () => {
        const hb = new HeartbeatDaemon(logger);

        try {
          const evoConfig = cfgGet<any>(config, 'evomap', null);
          if (evoConfig?.enabled) {
            const { EvoMapClient: EMC } = await import('../evomap/client.js');
            evomap = new EMC(evoConfig, logger);
            hb.registerEvoMapHeartbeat(evomap!);
          }
        } catch (err) {
          logger.warn('EvoMap init failed', { error: String(err) });
        }

        hb.start();
        return hb;
      });

      logger.info('Heartbeat started');

      // ── Assemble services ───────────────────────────────────────────
      this.services = {
        logger, config, db, wallet, soul, memory, inference,
        stateMachine: automaton.stateMachine,
        agentLoop: automaton.agentLoop,
        toolExecutor: automaton.toolExecutor,
        skills, heartbeat,
        taskQueue: automaton.taskQueue,
        httpServer: server.httpServer,
        wsServer: server.wsServer,
        evomap,
      };

      // Wake the agent
      automaton.stateMachine.boot();
      this._running = true;

      const totalMs = Date.now() - totalStart;
      logger.info('🐢 ConShell V2 operational', {
        totalMs, stages: this.stages.length,
        allOk: this.stages.every(s => s.ok),
      });

      return { ok: true, stages: this.stages, services: this.services, totalMs };

    } catch (err) {
      const failedStage = this.stages.find(s => !s.ok);
      return {
        ok: false, stages: this.stages, services: null,
        totalMs: Date.now() - totalStart, failedAt: failedStage?.stage,
      };
    }
  }

  /**
   * 优雅关闭
   */
  async shutdown(): Promise<void> {
    if (!this.services) return;

    const { logger, heartbeat, httpServer, stateMachine } = this.services;
    logger.info('🐢 Shutting down…');

    heartbeat.stop();
    await httpServer.stop();
    try { stateMachine.transition('die'); } catch { /* already dead */ }

    this._running = false;
    this.services = null;
    logger.info('🐢 Shutdown complete');
  }

  // ── Stage runner ──────────────────────────────────────────────────

  private async runStage<T>(stage: BootStage, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.stages.push({ stage, ok: true, durationMs: Date.now() - start });
      return result;
    } catch (err) {
      const durationMs = Date.now() - start;
      const error = err instanceof Error ? err.message : String(err);
      this.stages.push({ stage, ok: false, durationMs, error });
      throw err;
    }
  }
}

// ── Factory ───────────────────────────────────────────────────────────

export async function createKernel(overrides?: Partial<AppConfig>): Promise<BootResult> {
  const kernel = new Kernel();
  return kernel.boot(overrides);
}
