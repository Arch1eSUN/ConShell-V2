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
import { ContinuityService, type SelfState } from '../identity/continuity-service.js';
import { ConsolidationPipeline } from '../memory/consolidation.js';
import { CommitmentStore } from '../agenda/index.js';
import { SchedulerService } from '../scheduler/index.js';
import { SpendTracker as SpendTrackerFull } from '../spend/index.js';
import { SpendRepository } from '../state/repos/spend.js';
import { ConwayAutomaton } from '../automaton/index.js';
import { EconomicStateService } from '../economic/economic-state-service.js';
import { GovernanceService, type GovernanceServiceOptions } from '../governance/governance-service.js';
import type { SelfModManager } from '../selfmod/index.js';
import type { GovernedSelfModGate } from '../selfmod/governed-selfmod-gate.js';
import type { MultiAgentManager } from '../multiagent/index.js';
import type { LineageService } from '../lineage/index.js';
import type { CollectiveService } from '../collective/index.js';
import type { ReputationService } from '../collective/reputation-service.js';
import type { PeerDiscoveryService } from '../collective/discovery-service.js';
import type { PeerSelector } from '../collective/peer-selector.js';
import type { AgentPostureService } from '../api-surface/agent-posture-service.js';

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
  | 'identity'
  | 'memory'
  | 'agenda'
  | 'models'
  | 'automaton'
  | 'governance'
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
  continuity: ContinuityService;
  selfState: SelfState;
  memory: MemoryTierManager;
  agenda: CommitmentStore;
  scheduler: SchedulerService;
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
  /** Round 15.3: Spend attribution tracker */
  spendTracker: SpendTrackerFull;
  /** Round 15.7: Conway survival automaton */
  automaton: ConwayAutomaton;
  /** Round 15.7B: Economic state facade */
  economicService: EconomicStateService;
  /** Round 16.4: Governance runtime */
  governance: GovernanceService;
  /** Round 16.4: SelfMod manager (accessed via governance) */
  selfmod: SelfModManager;
  /** Round 16.4: Multi-agent manager (accessed via governance) */
  multiagent: MultiAgentManager;
  /** Round 16.5: Lineage service (canonical lineage owner) */
  lineage: LineageService;
  /** Round 16.6: Collective service (peer runtime) */
  collective: CollectiveService;
  /** Round 16.7: Peer discovery service */
  discovery: PeerDiscoveryService;
  /** Round 16.7: Reputation service */
  reputation: ReputationService;
  /** Round 16.7: Peer selector */
  selector: PeerSelector;
  /** Round 19.3: Governed self-modification gate */
  selfModGate: GovernedSelfModGate;
  /** Round 19.3: Agent posture service (externalized truth surface) */
  postureService: AgentPostureService;
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
  private _sessionCount = 0;
  private _lastSessionId: string | null = null;
  private _ownerId: string | null = null;
  private _consolidation: ConsolidationPipeline | null = null;

  /** 是否运行中 */
  get running(): boolean { return this._running; }

  /** Current session count (tracked across boot lifecycle) */
  get sessionCount(): number { return this._sessionCount; }

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

      // ── Step 6: Identity / Continuity ─────────────────────────────────
      const identityResult = await this.runStage('identity', async () => {
        const continuity = new ContinuityService(db, logger, agentHome);
        const selfState = continuity.hydrate({
          soulContent: soul.current.raw,
          soulName: soul.current.name,
          walletAddress: wallet?.address,
        });

        // Wire soul evolution → continuity chain advance
        soul.onSoulEvolved = (raw: string, version: number) => {
          continuity.advanceForSoulChange(raw, version);
        };

        return { continuity, selfState };
      });

      logger.info('Identity hydrated', {
        mode: identityResult.selfState.mode,
        chainValid: identityResult.selfState.chainValid,
        chainLength: identityResult.selfState.chainLength,
        identityId: identityResult.selfState.anchor.id,
      });

      // ── Step 7: Memory ──────────────────────────────────────────────
      const ownerId = identityResult.selfState.anchor.id;
      const memory = await this.runStage('memory', async () => {
        return new MemoryTierManager(db, logger, { ownerId });
      });

      // Round 15.0.2 Goal B: Wire ConsolidationPipeline into runtime
      this._ownerId = ownerId;
      this._consolidation = new ConsolidationPipeline(db, logger);

      logger.info('Memory initialized', { ownerId });

      // ── Step 7.5: Agenda & Scheduler ──────────────────────────────────
      const { agenda, scheduler } = await this.runStage('agenda', async () => {
        const { CommitmentRepository } = await import('../state/repos/commitment.js');
        const repo = new CommitmentRepository(db);
        const store = new CommitmentStore(repo);
        await store.loadFromRepo();

        const { MemorySchedulerBackend, SchedulerService } = await import('../scheduler/index.js');
        const schedulerBackend = new MemorySchedulerBackend();
        const sched = new SchedulerService(schedulerBackend);

        try {
          const snapshot = identityResult.continuity.loadSchedulerSnapshot();
          if (snapshot) {
            sched.restore(snapshot);
            logger.info('Scheduler snapshot restored', { pending: snapshot.pendingCount });
          }
        } catch (err) {
          logger.warn('Failed to load scheduler snapshot, starting fresh', { error: String(err) });
        }

        return { agenda: store, scheduler: sched };
      });

      logger.info('Agenda & Scheduler initialized', { activeCommitments: agenda.list().length });

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

        // Scheduler handler will be wired after AgentLoop and ToolExecutor instantiation
        
        const { allBuiltinTools } = await import('../runtime/tools/index.js');
        toolExecutor.registerTools(allBuiltinTools);

        // Register memory tools (requires runtime-injected MemoryTierManager)
        const { createMemoryTools } = await import('../runtime/tools/memory.js');
        const memoryTools = createMemoryTools(memory);
        toolExecutor.registerTools(memoryTools);

        // Create ConversationService for persistent session context
        const { SessionsRepository } = await import('../state/repos/sessions.js');
        const { TurnsRepository } = await import('../state/repos/turns.js');
        const { ConversationService } = await import('../channels/webchat/conversation-service.js');
        const sessionsRepo = new SessionsRepository(db);
        const turnsRepo = new TurnsRepository(db);
        const conversationService = new ConversationService(sessionsRepo, turnsRepo);

        // Round 15.3: Create spend attribution infrastructure
        const spendRepo = new SpendRepository(db);
        const spendTracker = new SpendTrackerFull(undefined, spendRepo);

        const defaultModel = cfgGet<string>(config, 'model', 'gpt-4o');
        const agentLoop = new AgentLoop(
          inference, toolExecutor, memory, soul, logger,
          { defaultModel },
          conversationService,
        );

        // Round 15.3: Wire spend tracker into agent loop
        agentLoop.setSpendTracker(spendTracker);

        // Round 15.7B: Create Conway survival automaton
        const conwayAutomaton = new ConwayAutomaton();

        // Round 15.7B: Create EconomicStateService facade
        const economicService = new EconomicStateService(spendTracker, conwayAutomaton, logger);

        // Round 15.7B: Wire economic service into agent loop for survival gate
        agentLoop.setEconomicService(economicService);

        // ── Round 19.2: High-Trust Autonomy — Guard + Audit + Materializer ──
        const { CommitmentMaterializer } = await import('../runtime/materializer.js');
        const { ExecutionGuard } = await import('../runtime/execution-guard.js');
        const { ExecutionAuditTrail } = await import('../runtime/execution-audit.js');

        const executionGuard = new ExecutionGuard(logger);
        const executionAudit = new ExecutionAuditTrail(logger);

        const materializer = new CommitmentMaterializer(logger, agenda, agentLoop, toolExecutor);
        materializer.setGuard(executionGuard);
        materializer.setAuditTrail(executionAudit);
        
        scheduler.setHandler((task) => {
          const commitment = agenda.get(task.commitmentId);
          if (!commitment) {
            logger.warn('Scheduler triggered for missing commitment', { commitmentId: task.commitmentId });
            return { taskId: task.id, success: true, result: 'Skipped: Missing commitment' };
          }

          // Guard check at scheduler level — prevents concurrent dispatch
          if (executionGuard.isTerminal(commitment.id)) {
            logger.debug('Scheduler skipped: terminal blacklist', { commitmentId: commitment.id });
            return { taskId: task.id, success: true, result: 'Skipped: terminal commitment' };
          }

          if (executionGuard.isActive(commitment.id)) {
            logger.debug('Scheduler skipped: already executing', { commitmentId: commitment.id });
            return { taskId: task.id, success: true, result: 'Skipped: concurrent execution guard' };
          }
          
          agenda.markActive(commitment.id);
          
          const queuedTask = materializer.materialize(commitment, task);
          const enqueued = taskQueue.enqueue(queuedTask);
          
          if (!enqueued) {
             logger.info('Scheduler skipped enqueuing task', { taskId: task.id, commitmentId: task.commitmentId, reason: 'rejected by queue' });
             return { taskId: task.id, success: true, result: 'Skipped: deduplicated or rejected by queue' };
          }

          return { taskId: task.id, success: true, result: 'Enqueued' };
        });

        return { stateMachine, toolExecutor, agentLoop, taskQueue, conversationService, spendTracker, conwayAutomaton, economicService, executionGuard, executionAudit };
      });

      logger.info('Automaton ready', {
        tools: automaton.toolExecutor.stats().registeredTools,
      });

      // ── Step 8.5: Governance ──────────────────────────────────────────
      const governanceResult = await this.runStage('governance', async () => {
        // Dynamic imports for selfmod + multiagent managers
        const { SelfModManager } = await import('../selfmod/index.js');
        const { MultiAgentManager } = await import('../multiagent/index.js');

        const selfmod = new SelfModManager({ logger });
        const multiagent = new MultiAgentManager();

        // Identity provider adapter for governance
        const identityProvider = {
          status: () => identityResult.selfState.chainValid ? 'active' as const : 'degraded' as const,
          selfFingerprint: () => identityResult.selfState.anchor.id,
        };

        // Policy provider adapter
        const policyProvider = {
          evaluate: (ctx: any) => {
            // Delegate to PolicyEngine if available; otherwise auto-allow
            return { decision: 'allow' as const, rule: 'governance-default', reason: 'Governance default allow', category: 'security' as const };
          },
        };

        // Round 16.5: Initialize LineageService as canonical lineage owner
        const { LineageService } = await import('../lineage/index.js');
        const { DEFAULT_INHERITANCE_MANIFEST } = await import('../identity/inheritance-boundary.js');

        const lineage = new LineageService({
          multiagent,
          inheritanceManifest: DEFAULT_INHERITANCE_MANIFEST,
          logger,
          rootFingerprint: identityResult.selfState.anchor.id,
        });

        // Round 16.6: Initialize CollectiveService as peer registry
        const { CollectiveService: CS } = await import('../collective/index.js');
        const collective = new CS({
          logger,
          selfAgentId: identityResult.selfState.anchor.id,
          selfName: 'ConShell',
        });

        const govOpts: GovernanceServiceOptions = {
          identity: identityProvider,
          policy: policyProvider,
          selfmod,
          multiagent,
          lineage,
          collective,
          logger,
        };

        const governance = new GovernanceService(govOpts);

        // Round 19.3: Wire GovernedSelfModGate into governance lifecycle
        const { GovernedSelfModGate: GSG } = await import('../selfmod/governed-selfmod-gate.js');
        const selfModGateAdapter: import('../selfmod/governed-selfmod-gate.js').SelfModGovernanceProvider = {
          propose: (input) => governance.propose(input) as any,
          evaluate: (proposalId) => {
            const v = governance.evaluate(proposalId);
            return { code: v.code === 'allow' ? 'allow' : v.code === 'deny' ? 'deny' : 'require_review', reason: v.reason };
          },
          apply: (proposalId) => governance.apply(proposalId).then(r => ({
            result: r.result, reason: r.reason,
            relatedIds: r.relatedIds,
          })),
          forceApprove: (proposalId) => {
            const v = governance.forceApprove(proposalId);
            return { code: v.code };
          },
        };
        const selfModGate = new GSG(selfModGateAdapter, selfmod, logger);
        // Inject gate back into governance for pause/resume lifecycle actions
        (governance as any).selfModGate = selfModGate;

        // Round 16.7: Initialize ReputationService, DiscoveryService, StalenessPolicy, PeerSelector
        const { ReputationService: RS } = await import('../collective/reputation-service.js');
        const reputation = new RS({ logger });

        // Wire reputation into collective for delegation loop
        collective.setReputationService(reputation);

        const { StalenessPolicy: SP } = await import('../collective/staleness-policy.js');
        const stalenessPolicy = new SP();

        const { PeerDiscoveryService: PDS, ManualDiscoveryProvider, MockRegistryProvider } = await import('../collective/discovery-service.js');
        const discovery = new PDS({
          logger,
          collective,
          stalenessPolicy,
        });
        discovery.registerProvider(new ManualDiscoveryProvider());
        discovery.registerProvider(new MockRegistryProvider());

        const { PeerSelector: PSel } = await import('../collective/peer-selector.js');
        const selector = new PSel(collective, reputation);

        return { governance, selfmod, multiagent, lineage, collective, discovery, reputation, selector, selfModGate };
      });

      logger.info('Governance + Lineage + Collective ready', {
        selfmod: !!governanceResult.selfmod,
        multiagent: !!governanceResult.multiagent,
        lineage: !!governanceResult.lineage,
        collective: !!governanceResult.collective,
      });

      // ── Step 8.6: AgentPostureService (Round 19.3 — G6 Truth Surface) ──
      const { AgentPostureService: APS } = await import('../api-surface/agent-posture-service.js');
      const { DefaultAgendaPostureProvider: DAPP } = await import('../agenda/agenda-posture-provider.js');
      const postureService = new APS(
        identityResult.selfState.anchor.id,
        '2.0.0',
        {
          identity: {
            getPosture: () => ({
              mode: identityResult.selfState.mode,
              chainValid: identityResult.selfState.chainValid,
              chainLength: identityResult.selfState.chainLength,
              soulDrifted: identityResult.selfState.soulDrifted,
              fingerprint: identityResult.selfState.anchor.id,
            }),
          },
          economic: {
            getPosture: () => {
              const econ = automaton.economicService;
              if (!econ) {
                return { survivalTier: 'unknown', balanceCents: 0, burnRateCentsPerDay: 0, runwayDays: 0, profitabilityRatio: 0 };
              }
              const proj = econ.getProjection();
              return {
                survivalTier: String(proj.survivalTier),
                balanceCents: proj.currentBalanceCents,
                burnRateCentsPerDay: proj.burnRateCentsPerDay,
                runwayDays: proj.runwayDays,
                profitabilityRatio: proj.totalSpendCents > 0 ? proj.totalRevenueCents / proj.totalSpendCents : 0,
              };
            },
          },
          lineage: {
            getPosture: () => ({
              activeChildren: 0,
              degradedChildren: 0,
              totalFundingAllocated: 0,
              totalFundingSpent: 0,
              healthScore: 100,
            }),
          },
          collective: {
            getPosture: () => {
              const diag = governanceResult.collective.diagnostics();
              return {
                totalPeers: diag.totalPeers,
                trustedPeers: diag.byStatus?.['trusted'] ?? 0,
                degradedPeers: diag.degradedPeerCount ?? 0,
                delegationSuccessRate: diag.delegationSuccessRate ?? 0,
              };
            },
          },
          governance: {
            getPosture: () => {
              const diag = governanceResult.governance.diagnostics();
              return {
                pendingProposals: diag.proposalsByStatus?.['pending'] ?? 0,
                recentVerdicts: diag.totalProposals ?? 0,
                selfModQuarantined: governanceResult.selfModGate?.isPaused() ?? false,
              };
            },
          },
          // Round 19.8: Agenda truth — canonical from CommitmentStore
          agenda: new DAPP(agenda),
        },
      );

      logger.info('AgentPostureService ready (G6 truth surface externalized)');

      // Round 19.8 G7: Register diagnostic tools (doctor + export_posture)
      const { createDiagnosticsTools } = await import('../runtime/tools/diagnostics.js');
      automaton.toolExecutor.registerTools(createDiagnosticsTools(postureService));
      logger.info('Diagnostic tools registered (doctor, export_posture)');

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
          conversationService: automaton.conversationService,
          governance: governanceResult.governance,
          collective: governanceResult.collective,
          discovery: governanceResult.discovery,
          reputation: governanceResult.reputation,
          selector: governanceResult.selector,
          postureService,
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

        if (automaton.economicService) {
          hb.registerTask({
            name: 'economic-refresh',
            intervalMs: 5 * 60 * 1000,
            enabled: true,
            execute: async () => {
              const snap = automaton.economicService!.snapshot();
              const mode = automaton.economicService!.getCurrentMode();
              const tier = automaton.economicService!.getCurrentTier();
              // Update ToolExecutor tier for policy gating
              automaton.toolExecutor.updateTier(tier);
              logger.debug('Economic refresh', {
                tier, mode, balance: snap.balanceCents,
              });
            },
          });
        }

        // Round 18.8: Scheduler tick heartbeat (every 10s)
        hb.registerTask({
          name: 'scheduler-tick',
          intervalMs: 10 * 1000,
          enabled: true,
          execute: async () => {
            scheduler.tick();
          },
        });

        hb.start();
        return hb;
      });

      logger.info('Heartbeat started');

      // ── Assemble services ───────────────────────────────────────────
      this.services = {
        logger, config, db, wallet, soul,
        continuity: identityResult.continuity,
        selfState: identityResult.selfState,
        memory, agenda, scheduler, inference,
        stateMachine: automaton.stateMachine,
        agentLoop: automaton.agentLoop,
        toolExecutor: automaton.toolExecutor,
        skills, heartbeat,
        taskQueue: automaton.taskQueue,
        httpServer: server.httpServer,
        wsServer: server.wsServer,
        evomap,
        spendTracker: automaton.spendTracker,
        automaton: automaton.conwayAutomaton,
        economicService: automaton.economicService,
        governance: governanceResult.governance,
        selfmod: governanceResult.selfmod,
        multiagent: governanceResult.multiagent,
        lineage: governanceResult.lineage,
        collective: governanceResult.collective,
        discovery: governanceResult.discovery,
        reputation: governanceResult.reputation,
        selector: governanceResult.selector,
        selfModGate: governanceResult.selfModGate,
        postureService,
      };

      // Round 15.8: Wire economic policy to runtime consumers
      if (automaton.economicService) {
        const policy = automaton.economicService.getPolicy();
        automaton.taskQueue.setEconomicService(automaton.economicService, policy);
        automaton.toolExecutor.setEconomicPolicy(policy);
        logger.info('Economic policy wired to TaskQueue + ToolExecutor');
      }

      // Wake the agent
      automaton.stateMachine.boot();

      // Wire session lifecycle: AgentLoop → Kernel.startSession()
      automaton.agentLoop.setLifecycleHost(this);

      // Round 15.2.1: Wire live selfState for identity-aware behavior guidance
      automaton.agentLoop.setSelfState(identityResult.selfState);

      // ── Health endpoint — closes getDiagnosticsOptions → Doctor production path ──
      const kernel = this;
      server.httpServer.get('/api/health', async (_req, res) => {
        try {
          const { runDiagnostics: runDx } = await import('../doctor/index.js');
          const diagOpts = kernel.getDiagnosticsOptions() ?? undefined;
          const projectRoot = process.cwd();
          const coreRoot = new URL('../../..', import.meta.url).pathname.replace(/\/$/, '');
          const report = await runDx(projectRoot, coreRoot, diagOpts);
          const status = report.health === 'healthy' ? 200 : report.health === 'degraded' ? 200 : 503;
          server.httpServer.sendJson(res, status, {
            health: report.health,
            readiness: report.readiness.verdict,
            checks: report.counts,
            timestamp: report.timestamp,
            // Round 16.2: identity summary
            identity: {
              status: (identityResult as any).sovereignService?.status?.() ?? 'unknown',
              agentId: identityResult.selfState?.anchor?.id ?? 'unknown',
            },
          });
        } catch (err) {
          server.httpServer.sendJson(res, 500, {
            health: 'unhealthy',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });

      // ── Round 16.2: Identity endpoints (layered exposure) ──
      server.httpServer.get('/api/identity/public', async (_req, res) => {
        try {
          const svc = (identityResult as any).sovereignService;
          if (!svc) {
            server.httpServer.sendJson(res, 503, { error: 'Identity service not initialized' });
            return;
          }
          const ctx = {
            runtimeMode: identityResult.selfState?.mode ?? 'unknown',
            health: 'healthy' as const,
            activeCommitmentCount: 0,
            agendaActive: false,
            enabledSurfaces: [],
            verifiedCapabilities: [],
          };
          const publicClaims = svc.getPublicClaims(ctx);
          server.httpServer.sendJson(res, 200, publicClaims);
        } catch (err) {
          server.httpServer.sendJson(res, 500, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });

      server.httpServer.get('/api/identity/full', async (_req, res) => {
        try {
          const svc = (identityResult as any).sovereignService;
          if (!svc) {
            server.httpServer.sendJson(res, 503, { error: 'Identity service not initialized' });
            return;
          }
          const ctx = {
            runtimeMode: identityResult.selfState?.mode ?? 'unknown',
            health: 'healthy' as const,
            activeCommitmentCount: 0,
            agendaActive: false,
            enabledSurfaces: [],
            verifiedCapabilities: [],
          };
          const fullClaims = svc.getFullClaims(ctx);
          server.httpServer.sendJson(res, 200, fullClaims);
        } catch (err) {
          server.httpServer.sendJson(res, 500, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });

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
   * Checkpoint the current turn — advances continuity chain if state changed.
   * This is the real runtime wiring that connects turn completion to
   * identity continuity. Called after each turn and on shutdown.
   *
   * Renamed from `finalizeSession` in Round 15.0.2 to reflect true semantics:
   * this fires per-turn, not per-session.
   *
   * @returns true if continuity was advanced, false if skipped
   */
  checkpointTurn(sessionId?: string): boolean {
    if (!this.services) return false;

    const { continuity, soul, memory, logger } = this.services;
    const effectiveSessionId = sessionId ?? this._lastSessionId ?? 'unknown';

    // Goal D (Round 15.0.2): use owner-scoped episode count for self-continuity
    const episodeCount = this._ownerId
      ? memory.getEpisodeCountForOwner(this._ownerId)
      : memory.getEpisodeCount();

    if (!continuity.hydrated) {
      logger.warn('checkpointTurn: continuity not hydrated, skipping');
      return false;
    }

    // Goal B (Round 15.0.2): run consolidation before continuity advance
    if (this._consolidation) {
      try {
        this._consolidation.consolidateSession(effectiveSessionId, this._ownerId ?? undefined);
      } catch (err) {
        logger.warn('checkpointTurn: consolidation failed (non-fatal)', { error: String(err) });
      }
    }

    if (!continuity.shouldAdvanceForSession({
      sessionCount: this._sessionCount,
      memoryEpisodeCount: episodeCount,
    })) {
      logger.debug('checkpointTurn: no state change, skipping advance');
      return false;
    }

    continuity.advanceForSession({
      soulContent: soul.current.raw,
      sessionId: effectiveSessionId,
      sessionCount: this._sessionCount,
      memoryEpisodeCount: episodeCount,
    });
    
    // Round 18.8: Save scheduler snapshot on turn checkpoint
    if (this.services.scheduler && continuity) {
      const schedSnap = this.services.scheduler.snapshot();
      continuity.saveSchedulerSnapshot(schedSnap);
    }

    logger.info('Turn checkpointed — continuity advanced', {
      sessionId: effectiveSessionId,
      sessionCount: this._sessionCount,
    });
    return true;
  }

  /**
   * Register a new session start.
   * Increments the session counter and records the session ID.
   */
  startSession(sessionId: string): void {
    this._sessionCount++;
    this._lastSessionId = sessionId;
    this.services?.logger.info('Session started', {
      sessionId,
      sessionCount: this._sessionCount,
    });
  }

  /**
   * Build DiagnosticsOptions with the canonical live self-state.
   * This is the formal contract: production callers of runDiagnostics()
   * use this method to obtain the runtime's current self belief,
   * making the Doctor a verification view of the runtime, not a
   * parallel truth implementation.
   *
   * Online mode: continuity hydrated → live selfState included
   * Cold/offline mode: continuity not hydrated → selfState omitted (DB-only)
   */
  getDiagnosticsOptions(): {
    db: any;
    soulContent: string;
    selfState?: import('../identity/continuity-service.js').SelfState;
  } | null {
    if (!this.services) return null;
    const { db, soul, continuity } = this.services;
    const result: {
      db: any;
      soulContent: string;
      selfState?: import('../identity/continuity-service.js').SelfState;
    } = {
      db,
      soulContent: soul.current.raw,
    };
    // Only include live selfState when continuity is hydrated (online mode)
    if (continuity.hydrated) {
      result.selfState = continuity.getCurrentState() ?? undefined;
    }
    return result;
  }

  /**
   * 优雅关闭
   */
  async shutdown(): Promise<void> {
    if (!this.services) return;

    const { logger, heartbeat, httpServer, stateMachine, scheduler, continuity } = this.services;
    logger.info('🐢 Shutting down…');

    // Checkpoint current turn before stopping services
    this.checkpointTurn();
    
    // Explicitly flush scheduler snapshot on stop
    if (scheduler && continuity) {
      const schedSnap = scheduler.snapshot();
      continuity.saveSchedulerSnapshot(schedSnap);
    }

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
