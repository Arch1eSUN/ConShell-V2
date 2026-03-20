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
  /** Round 17.7 → 17.8: Economic Kernel Foundation control surface */
  economicKernelFoundation?: {
    identityRegistry: {
      all(): ReadonlyArray<{ economicIdentityId: string; runtimeIdentityId: string; status: string; capabilityEnvelopeId: string; createdAt: string }>;
      isEligibleForEconomicActions(runtimeId: string): boolean;
    };
    envelopeManager: {
      getByEconomicIdentity(econId: string): { envelopeId: string; grantedScopes: ReadonlySet<string>; deniedScopes: ReadonlySet<string> } | undefined;
    };
    mandateEngine: {
      getActiveMandates(econId: string): ReadonlyArray<{ mandateId: string; purpose: string; remainingBudget: number; validUntil: string; status: string }>;
      all(): ReadonlyArray<{ mandateId: string; economicIdentityId: string; purpose: string; remainingBudget: number; status: string }>;
    };
    firewall: {
      stats(): { totalEvaluated: number; approved: number; rejected: number; pendingHuman: number; blockedExternal: number };
      recentBlocks(limit?: number): ReadonlyArray<{ candidateId: string; actionKind: string; finalDecision: string; rejectionReasons: readonly string[]; timestamp: string }>;
      allVerdicts(): ReadonlyArray<{ candidateId: string; actionKind: string; finalDecision: string; rejectionReasons: readonly string[]; timestamp: string }>;
    };
    auditLog: {
      getRecent(limit?: number): ReadonlyArray<{ eventId: string; actionClassification: string; firewallResult: string; createdAt: string }>;
      stats(): { total: number; approved: number; rejected: number; pendingHuman: number };
    };
    /** Round 17.8: Truth report */
    generateTruthReport(): {
      firewallSummary: unknown;
      mandateSummary: unknown;
      warnings: unknown[];
      derivedFacts: unknown[];
      [key: string]: unknown;
    };
    /** Round 17.8: Reward registry */
    rewardRegistry: {
      all(): ReadonlyArray<{ rewardId: string; kind: string; name: string; status: string; amountCents: number; totalClaimed: number; maxTotalClaims: number }>;
      getActive(): ReadonlyArray<{ rewardId: string; kind: string; name: string; status: string; amountCents: number }>;
    };
    /** Round 17.8: Claim engine */
    claimEngine: {
      getRecent(limit?: number): ReadonlyArray<{ claimId: string; rewardId: string; economicIdentityId: string; status: string; amountCents: number; createdAt: string }>;
      allReceipts(): ReadonlyArray<{ receiptId: string; claimId: string; rewardId: string; amountCents: number; issuedAt: string }>;
      stats(): { totalAttempts: number; approved: number; settled: number; rejected: number; ineligible: number; duplicate: number };
    };
    /** Round 17.9: Payment negotiation engine */
    negotiationEngine: {
      stats(): { totalNegotiations: number; allowed: number; rejected: number; pendingConfirmation: number; switchedProvider: number };
      allRequirements(): ReadonlyArray<{ requirementId: string; resource: string; providerId: string; amountCents: number; pricingMode: string; expiresAt: string; riskLevel: string }>;
      activeRequirements(): ReadonlyArray<{ requirementId: string; resource: string; providerId: string; amountCents: number }>;
      getRecentResults(limit?: number): ReadonlyArray<{ negotiationId: string; decision: string; requirementId: string; timestamp: string }>;
    };
    /** Round 17.9: Provider selector */
    providerSelector: {
      all(): ReadonlyArray<{ providerId: string; name: string; trustScore: number; riskLevel: string }>;
    };
    /** Round 17.9: Payment preparation manager */
    preparationManager: {
      getPending(): ReadonlyArray<{ intentId: string; negotiationId: string; requirementId: string; status: string; createdAt: string }>;
      getConfirmed(): ReadonlyArray<{ intentId: string; negotiationId: string; status: string; confirmedAt: string | null }>;
      all(): ReadonlyArray<{ intentId: string; negotiationId: string; requirementId: string; status: string }>;
    };
    /** Round 17.9: Negotiation audit log */
    negotiationAuditLog: {
      getRecent(limit?: number): ReadonlyArray<{ eventId: string; negotiationId: string; eventType: string; timestamp: string }>;
      summary(): { totalNegotiations: number; allowed: number; rejected: number; pendingConfirmation: number; switchedProvider: number; recentNegotiations: ReadonlyArray<{ negotiationId: string; decision: string; requirementId: string; timestamp: string }> };
      providerSummary(): { totalComparisons: number; providerUsageDistribution: Record<string, number>; averageSavingsCents: number };
    };
    /** Round 18.0: Settlement execution */
    settlementExecutionEngine: {
      getPendingSettlements(): ReadonlyArray<{ settlementId: string; negotiationId: string; status: string; amountCents: number }>;
      executeSettlement(proof: any, negotiation: any): { success: boolean; settlementId: string | null; reason: string | null };
      verifySettlement(settlementId: string, outcome: any): { success: boolean; settlementId: string; finalStatus: string; reason: string | null };
      getSettlement(settlementId: string): any;
    };
    revenueRealizationManager: {
      realizeSettlement(record: any, splits: any[]): any;
    };
    canonicalLedgerAdopter: {
      adoptRealization(realization: any): { success: boolean; realizationId: string; reason: string | null };
    };
    /** Round 18.1: Settlement governance layer */
    governanceLayer: {
      getExecutionSummary(): any;
      getVerificationSummary(): any;
      getByState(state: string): readonly any[];
      allRecords(): readonly any[];
    };
    /** Round 18.1: Canonical settlement ledger */
    settlementLedger: {
      getLedgerSummary(): any;
      allEntries(): readonly any[];
      allPending(): readonly any[];
      allFailed(): readonly any[];
      queryByDirection(direction: string): readonly any[];
    };
    /** Round 18.1: Settlement feedback engine */
    feedbackEngine: {
      getGlobalProfitabilitySummary(): any;
      getProviderRiskSignals(): readonly any[];
      getSurvivalFeedback(): any;
    };
    /** Round 18.2: Settlement runtime orchestrator */
    settlementRuntime: {
      listFlows(filter?: any): readonly any[];
      getFlowById(flowId: string): any;
      getFlowTrace(flowId: string): any;
      allFlowResults(): readonly any[];
    };
    /** Round 18.3: Settlement system coupling */
    settlementCoupling: {
      getSystemTruth(): any;
      getRuntimeImpactSummary(): any;
      getWritebackSummary(): any;
      getAgendaInfluenceSummary(): any;
    };
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
  // ── Round 17.7: Economic Kernel Foundation Control Surface ──────────

  routes.push({
    method: 'GET',
    path: '/api/economic/identity',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      const all = ekf.identityRegistry.all();
      return {
        identities: all,
        totalCount: all.length,
      };
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/economic/capabilities',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      const identities = ekf.identityRegistry.all();
      const envelopes = identities.map(id => ({
        economicIdentityId: id.economicIdentityId,
        envelope: ekf.envelopeManager.getByEconomicIdentity(id.economicIdentityId),
      }));
      return { envelopes };
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/economic/mandates',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      const all = ekf.mandateEngine.all();
      const active = all.filter((m: any) => m.status === 'active');
      return {
        activeMandates: active,
        totalMandates: all.length,
      };
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/economic/firewall',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      return {
        stats: ekf.firewall.stats(),
        recentBlocks: ekf.firewall.recentBlocks(10),
        auditStats: ekf.auditLog.stats(),
        recentAuditEvents: ekf.auditLog.getRecent(10),
      };
    },
  });

  // ── Round 17.8: Economic Truth Surface + Reward/Claim Routes ─────────

  routes.push({
    method: 'GET',
    path: '/api/economic/foundation',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      return ekf.generateTruthReport();
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/economic/rewards',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      const all = ekf.rewardRegistry.all();
      const active = ekf.rewardRegistry.getActive();
      const claimStats = ekf.claimEngine.stats();
      return {
        rewards: all,
        activeCount: active.length,
        totalCount: all.length,
        claimStats,
      };
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/economic/claims',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      return {
        recentClaims: ekf.claimEngine.getRecent(20),
        receipts: ekf.claimEngine.allReceipts(),
        stats: ekf.claimEngine.stats(),
      };
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/economic/diagnostics',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      const report = ekf.generateTruthReport();
      return {
        firewallDiagnostics: report.firewallSummary,
        mandateDiagnostics: report.mandateSummary,
        warnings: report.warnings,
        derivedFacts: report.derivedFacts,
      };
    },
  });

  // ── Round 17.9: Payment Negotiation + Provider Routes ───────────────

  routes.push({
    method: 'GET',
    path: '/api/economic/payments/requirements',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      const all = ekf.negotiationEngine.allRequirements();
      const active = ekf.negotiationEngine.activeRequirements();
      return {
        activeRequirements: active,
        totalRequirements: all.length,
        activeCount: active.length,
      };
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/economic/payments/negotiations',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      const stats = ekf.negotiationEngine.stats();
      const recent = ekf.negotiationEngine.getRecentResults(20);
      const auditSummary = ekf.negotiationAuditLog.summary();
      return {
        stats,
        recentNegotiations: recent,
        auditSummary,
      };
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/economic/payments/pending',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      const pending = ekf.preparationManager.getPending();
      const confirmed = ekf.preparationManager.getConfirmed();
      return {
        pendingIntents: pending,
        pendingCount: pending.length,
        confirmedIntents: confirmed,
        confirmedCount: confirmed.length,
      };
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/economic/payments/providers',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      const providers = ekf.providerSelector.all();
      const providerSummary = ekf.negotiationAuditLog.providerSummary();
      return {
        providers,
        totalProviders: providers.length,
        usageDistribution: providerSummary.providerUsageDistribution,
        averageSavingsCents: providerSummary.averageSavingsCents,
      };
    },
  });

  // ── Round 18.0: Settlement & Revenue ────────────────────────────────
  routes.push({
    method: 'GET',
    path: '/api/economic/settlement/pending',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      const pending = ekf.settlementExecutionEngine.getPendingSettlements();
      return { pending, count: pending.length };
    },
  });

  routes.push({
    method: 'POST',
    path: '/api/economic/settlement/execute',
    handler: async (body?: unknown) => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      const req = body as { proof: any; negotiation: any };
      return ekf.settlementExecutionEngine.executeSettlement(req.proof, req.negotiation);
    },
  });

  routes.push({
    method: 'POST',
    path: '/api/economic/settlement/verify',
    handler: async (body?: unknown) => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      const req = body as { settlementId: string; outcome: 'valid' | 'invalid' | 'timeout' };
      return ekf.settlementExecutionEngine.verifySettlement(req.settlementId, req.outcome);
    },
  });

  routes.push({
    method: 'POST',
    path: '/api/economic/settlement/realize',
    handler: async (body?: unknown) => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      const req = body as { settlementId: string; splits: any[] };
      const settlement = ekf.settlementExecutionEngine.getSettlement(req.settlementId);
      if (!settlement) return { error: 'Settlement not found' };
      
      const realization = ekf.revenueRealizationManager.realizeSettlement(settlement, req.splits);
      return ekf.canonicalLedgerAdopter.adoptRealization(realization);
    },
  });

  // ── Round 18.1: Truth Surface & Operator Diagnostics (G8) ───────────

  routes.push({
    method: 'GET',
    path: '/api/economic/settlements',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      return {
        executionSummary: ekf.governanceLayer.getExecutionSummary(),
        allRecords: ekf.governanceLayer.allRecords(),
      };
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/economic/settlements/pending',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      return {
        awaitingConfirmation: ekf.governanceLayer.getByState('awaiting_human_confirmation'),
        proofPending: ekf.governanceLayer.getByState('proof_pending'),
      };
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/economic/settlements/verification',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      return ekf.governanceLayer.getVerificationSummary();
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/economic/ledger',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      return ekf.settlementLedger.getLedgerSummary();
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/economic/revenue',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      const summary = ekf.settlementLedger.getLedgerSummary();
      return {
        realized: summary.revenue,
        pending: ekf.settlementLedger.allPending(),
        failed: ekf.settlementLedger.allFailed(),
      };
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/economic/profitability',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      return {
        profitability: ekf.feedbackEngine.getGlobalProfitabilitySummary(),
        providerRisk: ekf.feedbackEngine.getProviderRiskSignals(),
        survivalFeedback: ekf.feedbackEngine.getSurvivalFeedback(),
      };
    },
  });

  // ── Round 18.2: Settlement Flow APIs ──────────────────────────────

  routes.push({
    method: 'GET',
    path: '/api/economic/settlement-flows',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      return {
        flows: ekf.settlementRuntime.listFlows(),
        total: ekf.settlementRuntime.allFlowResults().length,
      };
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/economic/settlement-flows/:id',
    handler: async (params: any) => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      const result = ekf.settlementRuntime.getFlowById(params.id);
      if (!result) return { error: `Flow ${params.id} not found` };
      return result;
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/economic/settlement-flows/:id/trace',
    handler: async (params: any) => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      const trace = ekf.settlementRuntime.getFlowTrace(params.id);
      if (!trace) return { error: `Flow trace for ${params.id} not found` };
      return trace;
    },
  });

  // ── Round 18.3: Economic Truth Surface APIs ───────────────────────

  routes.push({
    method: 'GET',
    path: '/api/economic/runtime-truth',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      return ekf.settlementCoupling.getSystemTruth();
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/economic/runtime-impact',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      return ekf.settlementCoupling.getRuntimeImpactSummary();
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/economic/settlement-writeback',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      return ekf.settlementCoupling.getWritebackSummary();
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/economic/agenda-influence',
    handler: async () => {
      const ekf = services.economicKernelFoundation;
      if (!ekf) return { error: 'EconomicKernelFoundation not configured' };
      return ekf.settlementCoupling.getAgendaInfluenceSummary();
    },
  });

  return routes;
}
