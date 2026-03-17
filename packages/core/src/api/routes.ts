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

  return routes;
}
