/**
 * API Routes — Dashboard数据联通端点
 *
 * 7个新增API端点:
 *   /api/wallet/info      — Agent钱包信息
 *   /api/wallet/sessions  — WalletConnect会话列表
 *   /api/wallet/sync-external — 同步外部钱包连接
 *   /api/memory/stats      — 记忆系统统计
 *   /api/tools/list        — 已注册工具列表
 *   /api/inference/stats   — 推理路由统计
 *   /api/policy/stats      — 策略引擎统计
 *
 * 导出为纯函数handler，可被express/hono/native-http挂载
 */

export interface ApiHandler {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handler: (body?: unknown) => Promise<unknown>;
}

export interface ApiServices {
  onchainProvider?: {
    getAllBalances: (address: string) => Promise<unknown>;
    canSurvive: (address: string) => Promise<{ tier: string; hasEnough: boolean }>;
  };
  walletManager?: {
    getPrimary: () => { address: string; provider: string } | null;
    getConnectors: () => Array<{ id: string; type: string; address: string | null; connected: boolean }>;
  };
  wcBridge?: {
    listActiveSessions: () => Array<{ id: string; peerName: string; chainId: number; createdAt: string }>;
  };
  memoryManager?: {
    stats: () => { hotCount: number; warmCount: number; coldCount: number; totalCount: number; lastCompacted: string | null };
  };
  toolRegistry?: {
    listAll: () => Array<{ name: string; category: string; riskLevel: string; mcpExposed: boolean }>;
    stats: () => { total: number; byCategory: Record<string, number>; byRisk: Record<string, number>; mcpExposed: number; totalCalls: number };
  };
  inferenceRouter?: {
    stats: () => { totalTokensEstimate: number; totalCostCents: number; survivalTier: string; primaryProvider: string | null; providerCount: number };
    listProviders: () => string[];
  };
  policyEngine?: {
    stats: () => { evaluations: number; denies: number; escalations: number; ruleCount: number; toolCount: number };
    listRules: () => Array<{ name: string; category: string }>;
  };
  // ── Round 16.9.1: Economic control surface ──────────────────────────
  economicStateService?: {
    getProjection: () => {
      totalRevenueCents: number; totalSpendCents: number; currentBalanceCents: number;
      reserveCents: number; burnRateCentsPerDay: number; dailyRevenueCents: number;
      netFlowCentsPerDay: number; runwayDays: number; survivalTier: string;
      isSelfSustaining: boolean; revenueBySource: Record<string, number>;
      projectedAt: string;
    };
    snapshot: () => {
      balanceCents: number; survivalTier: string; burnRateCentsPerDay: number;
      survivalDays: number; isSelfSustaining: boolean;
    };
    currentSurvivalState: () => {
      tier: string; health: string; isEmergency: boolean;
      projection: unknown; constraints: unknown;
    };
  };
  survivalGate?: {
    explain: (state: unknown) => unknown;
    canAcceptTaskDetailed: (state: unknown, rev: boolean, pres: boolean) => unknown;
  };
  agendaGenerator?: {
    explainFactors: (projection: unknown) => unknown;
  };
  revenueService?: {
    stats: () => { totalRevenueCents: number; eventCount: number; byProtocol: Record<string, number> };
    recentReceipts?: () => Array<{ surfaceId: string; amountCents: number; createdAt: string }>;
  };
  // ── Round 17.0 / 17.1: Governance control surface ───────────────────
  governanceService?: {
    allVerdicts(): ReadonlyArray<{ id: string; proposalId: string; code: string; reason: string; riskLevel: string; timestamp: string }>;
    getVerdict(proposalId: string): { id: string; code: string; reason: string; constraints: readonly unknown[]; survivalContext: unknown } | undefined;
    diagnostics(): { totalProposals: number; totalReceipts: number; approvalRate: number; denialRate: number; escalationRate: number };
    listProposals(filter?: unknown): Array<{ id: string; actionKind: string; status: string; target: string; createdAt: string }>;
    /** Round 17.1: Trace chain */
    getTraceChain(proposalId: string): { proposalId: string; actionKind: string; status: string; verdictId?: string; verdictCode?: string; receipts: Array<{ id: string; phase: string; result: string }>; timestamp: string } | undefined;
  };
  lineageService?: {
    getAllRecords(): ReadonlyArray<{ id: string; parentId: string; childId: string; status: string; createdAt: string }>;
    getStats(): { totalChildren: number; activeChildren: number; quarantinedChildren?: number; compromisedChildren?: number };
  };
  branchControl?: {
    getBranchStatus(recordId: string): { recordId: string; status: string; descendantCount: number; quarantinedDescendants: number; compromisedDescendants: number } | undefined;
    getCompromisedBranches(): ReadonlyArray<{ id: string; status: string }>;
  };
  /** Round 17.2: Delegation governance control surface */
  delegationEnforcer?: {
    getSummary(): { activeDelegations: number; totalViolations: number; totalEvents: number; violationsByKind: Record<string, number>; delegationsByPeer: Record<string, string> };
    getViolations(peerId?: string): ReadonlyArray<{ id: string; peerId: string; delegationId: string; violationKind: string; attemptedAction: string; scopeLimit: string; timestamp: string }>;
  };
  /** Round 17.3: Autonomous operation control surface */
  schedulerService?: {
    stats(): { total: number; pending: number; dispatched: number; completed: number; failed: number; skipped: number; tickCount: number };
    pendingTasks(): Array<{ id: string; commitmentId: string; taskType: string; dueAt: string; status: string }>;
    overdueTasks(now?: string): Array<{ id: string; commitmentId: string; taskType: string; dueAt: string; status: string }>;
  };
  checkpointManager?: {
    loadLatestCheckpoint(): { timestamp: string; sequenceNumber: number; activeCommitmentIds: string[]; unfulfilledPaidIds: string[] } | null;
    count: number;
  };
  revenueSeekingEngine?: {
    getPrioritized(): Array<{ id: string; surfaceId: string; description: string; estimatedRevenueCents: number; status: string }>;
    all(): Array<{ id: string; surfaceId: string; description: string; estimatedRevenueCents: number; status: string }>;
  };
  /** Round 17.4: Sovereign Identity control surface */
  identityService?: {
    status(): string;
    selfFingerprint(): string;
    getIdentityHistory(): ReadonlyArray<{ id: string; version: number; status: string; createdAt: string }>;
    getActiveRecord(): { id: string; version: number; name: string; status: string } | null;
    serialize(): { records: unknown; status: string };
  };
  /** Round 17.4: Claims Registry control surface */
  claimRegistry?: {
    getActiveClaims(): ReadonlyArray<{ claimId: string; claimType: string; subject: string; scope: string }>;
    getByType(type: string): ReadonlyArray<{ claimId: string; subject: string }>;
  };
  profitabilityEvaluator?: {
    evaluate(commitment: unknown, projection: unknown): { verdict: string; reason: string; commitmentId: string };
  };
}

/**
 * 创建API路由处理器
 */
export function createApiRoutes(services: ApiServices): ApiHandler[] {
  const routes: ApiHandler[] = [];

  // ── Wallet Info ──────────────────────────────────────────────────────
  routes.push({
    method: 'GET',
    path: '/api/wallet/info',
    handler: async () => {
      const primary = services.walletManager?.getPrimary();
      if (!primary) {
        return { address: null, balances: null, tier: 'dead' };
      }

      let balances = null;
      let tier = 'unknown';
      if (services.onchainProvider) {
        balances = await services.onchainProvider.getAllBalances(primary.address);
        const survival = await services.onchainProvider.canSurvive(primary.address);
        tier = survival.tier;
      }

      return {
        address: primary.address,
        provider: primary.provider,
        balances,
        survivalTier: tier,
      };
    },
  });

  // ── WalletConnect Sessions ──────────────────────────────────────────
  routes.push({
    method: 'GET',
    path: '/api/wallet/sessions',
    handler: async () => {
      return services.wcBridge?.listActiveSessions() ?? [];
    },
  });

  // ── Sync External Wallet ────────────────────────────────────────────
  routes.push({
    method: 'POST',
    path: '/api/wallet/sync-external',
    handler: async (body) => {
      const { address, chainId, walletType, connected } = body as {
        address: string;
        chainId: number;
        walletType: string;
        connected: boolean;
      };
      // 实际同步逻辑会通过WalletManager执行
      return {
        synced: true,
        externalWallet: { address, chainId, walletType, connected },
      };
    },
  });

  // ── Memory Stats ────────────────────────────────────────────────────
  routes.push({
    method: 'GET',
    path: '/api/memory/stats',
    handler: async () => {
      return services.memoryManager?.stats() ?? {
        hotCount: 0,
        warmCount: 0,
        coldCount: 0,
        totalCount: 0,
        lastCompacted: null,
      };
    },
  });

  // ── Tools List ──────────────────────────────────────────────────────
  routes.push({
    method: 'GET',
    path: '/api/tools/list',
    handler: async () => {
      const list = services.toolRegistry?.listAll() ?? [];
      const stats = services.toolRegistry?.stats();
      return { tools: list, stats };
    },
  });

  // ── Inference Stats ─────────────────────────────────────────────────
  routes.push({
    method: 'GET',
    path: '/api/inference/stats',
    handler: async () => {
      return {
        ...services.inferenceRouter?.stats(),
        providers: services.inferenceRouter?.listProviders() ?? [],
      };
    },
  });

  // ── Policy Stats ────────────────────────────────────────────────────
  routes.push({
    method: 'GET',
    path: '/api/policy/stats',
    handler: async () => {
      return {
        ...services.policyEngine?.stats(),
        rules: services.policyEngine?.listRules() ?? [],
      };
    },
  });

  // ── Round 16.9.1: Economic Snapshot ──────────────────────────────────
  routes.push({
    method: 'GET',
    path: '/api/economic/snapshot',
    handler: async () => {
      const svc = services.economicStateService;
      if (!svc) {
        return { error: 'EconomicStateService not configured' };
      }
      const proj = svc.getProjection();
      const survival = svc.currentSurvivalState();
      const revenue = services.revenueService?.stats();
      return {
        // Factual
        totalRevenueCents: proj.totalRevenueCents,
        totalSpendCents: proj.totalSpendCents,
        currentBalanceCents: proj.currentBalanceCents,
        revenueBySource: proj.revenueBySource,
        // Derived
        burnRateCentsPerDay: proj.burnRateCentsPerDay,
        dailyRevenueCents: proj.dailyRevenueCents,
        netFlowCentsPerDay: proj.netFlowCentsPerDay,
        runwayDays: proj.runwayDays,
        reserveCents: proj.reserveCents,
        isSelfSustaining: proj.isSelfSustaining,
        // Threshold
        reserveFloorCents: 1_000,
        mustPreserveWindowMinutes: 15,
        // Explanatory
        projectionOwner: 'EconomicStateService' as const,
        survivalTier: proj.survivalTier,
        economicHealth: survival.health,
        isEmergency: survival.isEmergency,
        // Revenue stats
        revenueStats: revenue ?? null,
        // Meta
        projectedAt: proj.projectedAt,
      };
    },
  });

  // ── Round 16.9.1: Survival Gate Status ──────────────────────────────
  routes.push({
    method: 'GET',
    path: '/api/economic/gate',
    handler: async () => {
      const svc = services.economicStateService;
      const gate = services.survivalGate;
      if (!svc || !gate) {
        return { error: 'Economic services not configured' };
      }
      const state = svc.snapshot();
      const explanation = gate.explain(state);
      // Sample decisions for common task classes
      const sampleDecisions = {
        nonRevenueTask: gate.canAcceptTaskDetailed(state, false, false),
        revenueTask: gate.canAcceptTaskDetailed(state, true, false),
        mustPreserveTask: gate.canAcceptTaskDetailed(state, false, true),
      };
      return { explanation, sampleDecisions };
    },
  });

  // ── Round 16.9.1: Agenda Economic Factors ───────────────────────────
  routes.push({
    method: 'GET',
    path: '/api/economic/agenda-factors',
    handler: async () => {
      const svc = services.economicStateService;
      const agenda = services.agendaGenerator;
      if (!svc || !agenda) {
        return { error: 'Economic or Agenda services not configured' };
      }
      const proj = svc.getProjection();
      return agenda.explainFactors(proj);
    },
  });

  // ── Round 17.0: Governance Decisions ────────────────────────────────
  routes.push({
    method: 'GET',
    path: '/api/governance/decisions',
    handler: async () => {
      const gov = services.governanceService;
      if (!gov) return { error: 'GovernanceService not configured' };
      const verdicts = gov.allVerdicts();
      const diag = gov.diagnostics();
      return {
        recentVerdicts: verdicts.slice(-20),
        totalVerdicts: verdicts.length,
        diagnostics: diag,
      };
    },
  });

  // ── Round 17.0: Lineage Graph ──────────────────────────────────────
  routes.push({
    method: 'GET',
    path: '/api/governance/lineage',
    handler: async () => {
      const lin = services.lineageService;
      const bc = services.branchControl;
      if (!lin) return { error: 'LineageService not configured' };
      const records = lin.getAllRecords();
      const stats = lin.getStats();
      const compromised = bc?.getCompromisedBranches() ?? [];
      return {
        records: records.slice(-50),
        totalRecords: records.length,
        stats,
        compromisedBranches: compromised,
      };
    },
  });

  // ── Round 17.0: Branch Status ──────────────────────────────────────
  routes.push({
    method: 'GET',
    path: '/api/governance/branch/:id',
    handler: async (body?: unknown) => {
      const bc = services.branchControl;
      if (!bc) return { error: 'BranchControl not configured' };
      const id = (body as Record<string, string>)?.id ?? '';
      if (!id) return { error: 'Branch ID required' };
      const status = bc.getBranchStatus(id);
      if (!status) return { error: `Branch not found: ${id}` };
      return status;
    },
  });

  // ── Round 17.1: Governance Trace ────────────────────────────────────
  routes.push({
    method: 'GET',
    path: '/api/governance/trace/:proposalId',
    handler: async (body?: unknown) => {
      const gov = services.governanceService;
      if (!gov) return { error: 'GovernanceService not configured' };
      const proposalId = (body as Record<string, string>)?.proposalId ?? '';
      if (!proposalId) return { error: 'proposalId required' };
      const trace = gov.getTraceChain(proposalId);
      if (!trace) return { error: `Proposal not found: ${proposalId}` };
      return trace;
    },
  });

  // ── Round 17.2: Delegation Governance Summary ───────────────────────
  routes.push({
    method: 'GET',
    path: '/api/governance/delegations/summary',
    handler: async () => {
      const del = services.delegationEnforcer;
      if (!del) return { error: 'DelegationEnforcer not configured' };
      return del.getSummary();
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/governance/delegations/violations',
    handler: async () => {
      const del = services.delegationEnforcer;
      if (!del) return { error: 'DelegationEnforcer not configured' };
      return { violations: del.getViolations() };
    },
  });

  // ── Round 17.3: Autonomous Operation Control Surface ─────────────────
  routes.push({
    method: 'GET',
    path: '/api/autonomous/status',
    handler: async () => {
      const eco = services.economicStateService;
      const sched = services.schedulerService;
      const ckpt = services.checkpointManager;
      const rev = services.revenueSeekingEngine;

      return {
        economic: eco ? eco.snapshot() : null,
        scheduler: sched ? sched.stats() : null,
        checkpoint: ckpt ? { latest: ckpt.loadLatestCheckpoint(), count: ckpt.count } : null,
        revenueOpportunities: rev ? rev.getPrioritized().length : 0,
      };
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/autonomous/scheduler',
    handler: async () => {
      const sched = services.schedulerService;
      if (!sched) return { error: 'SchedulerService not configured' };
      return {
        stats: sched.stats(),
        pending: sched.pendingTasks(),
        overdue: sched.overdueTasks(),
      };
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/autonomous/revenue-opportunities',
    handler: async () => {
      const rev = services.revenueSeekingEngine;
      if (!rev) return { error: 'RevenueSeekingEngine not configured' };
      return {
        prioritized: rev.getPrioritized(),
        all: rev.all(),
      };
    },
  });

  // ── Round 17.4: Sovereign Identity Control Surface ────────────────────
  routes.push({
    method: 'GET',
    path: '/api/identity/sovereign',
    handler: async () => {
      const idSvc = services.identityService;
      const claims = services.claimRegistry;
      if (!idSvc) return { error: 'IdentityService not configured' };
      return {
        status: idSvc.status(),
        fingerprint: idSvc.selfFingerprint(),
        activeRecord: idSvc.getActiveRecord(),
        history: idSvc.getIdentityHistory(),
        claims: claims ? {
          active: claims.getActiveClaims(),
          capabilities: claims.getByType('capability'),
          services: claims.getByType('service'),
        } : null,
        snapshot: idSvc.serialize(),
      };
    },
  });

  return routes;
}
