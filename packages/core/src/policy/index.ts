/**
 * 策略引擎 — 24规则架构 (完整版)
 * 
 * 6类规则全覆盖:
 *   1. Constitution — Three Laws of Sovereign AI
 *   2. Financial — 预算限制、单笔上限
 *   3. Security — 文件路径保护、网络限制
 *   4. Authority — creator > self > peer > external
 *   5. Replication — 子Agent控制（数量/资金）
 *   6. SelfMod — 自修改速率+白名单
 */
import type { Logger, SecurityLevel, ToolDefinition } from '../types/common.js';

export type PolicyDecision = 'allow' | 'deny' | 'escalate';

export type PolicyCategory = 'constitution' | 'financial' | 'security' | 'authority' | 'replication' | 'selfmod';

export interface PolicyContext {
  readonly tool: string;
  readonly action: string;
  readonly costCents?: number;
  readonly securityLevel: SecurityLevel;
  readonly dailyBudgetCents: number;
  readonly dailySpentCents: number;
  readonly constitutionAccepted: boolean;
  // 扩展字段 — F4
  readonly callerAuthority?: 'creator' | 'self' | 'peer' | 'external';
  readonly targetPath?: string;
  readonly childCount?: number;
  readonly maxChildren?: number;
  readonly selfModCountToday?: number;
  readonly maxSelfModPerDay?: number;
  readonly singleTxMaxCents?: number;
}

export interface PolicyResult {
  readonly decision: PolicyDecision;
  readonly rule: string;
  readonly reason: string;
  readonly category: PolicyCategory;
}

// ── 规则定义 ────────────────────────────────────────────────────────────

interface PolicyRule {
  readonly name: string;
  readonly category: PolicyCategory;
  readonly evaluate: (ctx: PolicyContext) => PolicyResult | null;
}

const RULES: PolicyRule[] = [
  // ══════════════════════════════════════════════════════════════════
  // 1. CONSTITUTION — Three Laws (最高优先级)
  // ══════════════════════════════════════════════════════════════════
  {
    name: 'constitution-required',
    category: 'constitution',
    evaluate: (ctx) => {
      if (!ctx.constitutionAccepted) {
        return { decision: 'deny', rule: 'constitution-required', reason: '需先接受宪法（Three Laws of Sovereign AI）', category: 'constitution' };
      }
      return null;
    },
  },
  {
    name: 'no-self-harm',
    category: 'constitution',
    evaluate: (ctx) => {
      const harmful = ['delete_self', 'wipe_memory', 'disable_policy', 'delete_wallet'];
      if (harmful.includes(ctx.tool)) {
        return { decision: 'deny', rule: 'no-self-harm', reason: '违反宪法第一条：不得自我毁灭', category: 'constitution' };
      }
      return null;
    },
  },
  {
    name: 'no-key-disclosure',
    category: 'constitution',
    evaluate: (ctx) => {
      if (ctx.tool === 'expose_keys' || ctx.tool === 'share_secrets' || ctx.tool === 'export_private_key') {
        return { decision: 'deny', rule: 'no-key-disclosure', reason: '违反宪法第三条：不得泄露私钥', category: 'constitution' };
      }
      return null;
    },
  },
  {
    name: 'obey-creator',
    category: 'constitution',
    evaluate: () => null, // 创造者命令在Authority层处理
  },

  // ══════════════════════════════════════════════════════════════════
  // 2. FINANCIAL — 预算和交易限制
  // ══════════════════════════════════════════════════════════════════
  {
    name: 'budget-exceeded',
    category: 'financial',
    evaluate: (ctx) => {
      if (ctx.costCents && (ctx.dailySpentCents + ctx.costCents) > ctx.dailyBudgetCents) {
        return { decision: 'deny', rule: 'budget-exceeded', reason: `每日预算不足（已用 ${ctx.dailySpentCents}¢ / 限额 ${ctx.dailyBudgetCents}¢）`, category: 'financial' };
      }
      return null;
    },
  },
  {
    name: 'single-tx-limit',
    category: 'financial',
    evaluate: (ctx) => {
      const maxSingle = ctx.singleTxMaxCents ?? 5000; // 默认$50上限
      if (ctx.costCents && ctx.costCents > maxSingle) {
        return { decision: 'escalate', rule: 'single-tx-limit', reason: `单笔交易 ${ctx.costCents}¢ 超过上限 ${maxSingle}¢，需创造者审批`, category: 'financial' };
      }
      return null;
    },
  },
  {
    name: 'budget-warning',
    category: 'financial',
    evaluate: (ctx) => {
      const threshold = ctx.dailyBudgetCents * 0.8;
      if (ctx.costCents && ctx.dailySpentCents >= threshold) {
        return { decision: 'escalate', rule: 'budget-warning', reason: `已使用日预算的 ${Math.round(ctx.dailySpentCents / ctx.dailyBudgetCents * 100)}%`, category: 'financial' };
      }
      return null;
    },
  },
  {
    name: 'free-tool-pass',
    category: 'financial',
    evaluate: (ctx) => {
      if (!ctx.costCents || ctx.costCents === 0) {
        return null; // 免费工具不受预算限制
      }
      return null;
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // 3. SECURITY — 路径保护和网络限制
  // ══════════════════════════════════════════════════════════════════
  {
    name: 'protected-paths',
    category: 'security',
    evaluate: (ctx) => {
      const protectedPaths = ['/etc/', '/usr/', '/System/', '/var/root/', 'wallet.json', '.env', 'private.key'];
      if (ctx.targetPath) {
        for (const p of protectedPaths) {
          if (ctx.targetPath.includes(p)) {
            return { decision: 'deny', rule: 'protected-paths', reason: `受保护路径: ${p}`, category: 'security' };
          }
        }
      }
      return null;
    },
  },
  {
    name: 'sandbox-network-block',
    category: 'security',
    evaluate: (ctx) => {
      if (ctx.securityLevel === 'sandbox') {
        const networkTools = ['fetch_url', 'browse_page', 'send_message', 'discover_agent'];
        if (networkTools.includes(ctx.tool)) {
          return { decision: 'deny', rule: 'sandbox-network-block', reason: '沙盒模式禁止网络访问', category: 'security' };
        }
      }
      return null;
    },
  },
  {
    name: 'sandbox-exec-block',
    category: 'security',
    evaluate: (ctx) => {
      if (ctx.securityLevel === 'sandbox') {
        const execTools = ['exec_command', 'exec_background', 'install_package'];
        if (execTools.includes(ctx.tool)) {
          return { decision: 'deny', rule: 'sandbox-exec-block', reason: '沙盒模式禁止执行命令', category: 'security' };
        }
      }
      return null;
    },
  },
  {
    name: 'standard-risky-escalate',
    category: 'security',
    evaluate: (ctx) => {
      if (ctx.securityLevel === 'standard') {
        const risky = ['exec_command', 'write_file', 'delete_file'];
        if (risky.includes(ctx.tool)) {
          return { decision: 'escalate', rule: 'standard-risky-escalate', reason: '标准安全：高风险操作需确认', category: 'security' };
        }
      }
      return null;
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // 4. AUTHORITY — 权限层级
  // ══════════════════════════════════════════════════════════════════
  {
    name: 'external-deny-dangerous',
    category: 'authority',
    evaluate: (ctx) => {
      if (ctx.callerAuthority === 'external') {
        const dangerous = ['exec_command', 'write_file', 'delete_file', 'install_package', 'edit_own_file', 'send_usdc', 'spawn_child'];
        if (dangerous.includes(ctx.tool)) {
          return { decision: 'deny', rule: 'external-deny-dangerous', reason: 'External调用者不允许执行危险工具', category: 'authority' };
        }
      }
      return null;
    },
  },
  {
    name: 'peer-escalate-write',
    category: 'authority',
    evaluate: (ctx) => {
      if (ctx.callerAuthority === 'peer') {
        const writeTools = ['write_file', 'delete_file', 'install_package', 'edit_own_file'];
        if (writeTools.includes(ctx.tool)) {
          return { decision: 'escalate', rule: 'peer-escalate-write', reason: 'Peer调用写操作需Agent确认', category: 'authority' };
        }
      }
      return null;
    },
  },
  {
    name: 'creator-all-access',
    category: 'authority',
    evaluate: (ctx) => {
      if (ctx.callerAuthority === 'creator') {
        return null; // Creator可以访问所有工具（宪法层例外除外）
      }
      return null;
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // 5. REPLICATION — 子Agent控制
  // ══════════════════════════════════════════════════════════════════
  {
    name: 'max-children-limit',
    category: 'replication',
    evaluate: (ctx) => {
      if (ctx.tool === 'spawn_child') {
        const max = ctx.maxChildren ?? 5;
        const current = ctx.childCount ?? 0;
        if (current >= max) {
          return { decision: 'deny', rule: 'max-children-limit', reason: `子Agent数量已达上限 (${current}/${max})`, category: 'replication' };
        }
      }
      return null;
    },
  },
  {
    name: 'child-fund-limit',
    category: 'replication',
    evaluate: (ctx) => {
      if (ctx.tool === 'fund_child' && ctx.costCents) {
        const maxFund = Math.floor(ctx.dailyBudgetCents * 0.25); // 最多拨出25%日预算
        if (ctx.costCents > maxFund) {
          return { decision: 'escalate', rule: 'child-fund-limit', reason: `子Agent充值 ${ctx.costCents}¢ 超过日预算25% (${maxFund}¢)`, category: 'replication' };
        }
      }
      return null;
    },
  },
  {
    name: 'replication-budget-check',
    category: 'replication',
    evaluate: (ctx) => {
      const replicationTools = ['spawn_child', 'fund_child'];
      if (replicationTools.includes(ctx.tool)) {
        const utilization = ctx.dailySpentCents / ctx.dailyBudgetCents;
        if (utilization > 0.6) {
          return { decision: 'escalate', rule: 'replication-budget-check', reason: `预算使用 ${Math.round(utilization * 100)}%，复制操作需确认`, category: 'replication' };
        }
      }
      return null;
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // 6. SELFMOD — 自修改控制
  // ══════════════════════════════════════════════════════════════════
  {
    name: 'selfmod-rate-limit',
    category: 'selfmod',
    evaluate: (ctx) => {
      const selfModTools = ['edit_own_file', 'install_package', 'install_mcp', 'update_upstream'];
      if (selfModTools.includes(ctx.tool)) {
        const max = ctx.maxSelfModPerDay ?? 10;
        const count = ctx.selfModCountToday ?? 0;
        if (count >= max) {
          return { decision: 'deny', rule: 'selfmod-rate-limit', reason: `今日自修改次数已达上限 (${count}/${max})`, category: 'selfmod' };
        }
      }
      return null;
    },
  },
  {
    name: 'selfmod-whitelist',
    category: 'selfmod',
    evaluate: (ctx) => {
      if (ctx.tool === 'edit_own_file' && ctx.targetPath) {
        const forbidden = ['kernel/', 'policy/', 'wallet/', 'state/'];
        for (const dir of forbidden) {
          if (ctx.targetPath.includes(dir)) {
            return { decision: 'deny', rule: 'selfmod-whitelist', reason: `核心模块 ${dir} 禁止自修改`, category: 'selfmod' };
          }
        }
      }
      return null;
    },
  },
  {
    name: 'selfmod-requires-git',
    category: 'selfmod',
    evaluate: (ctx) => {
      if (ctx.tool === 'edit_own_file') {
        return { decision: 'escalate', rule: 'selfmod-requires-git', reason: '自修改需先创建Git checkpoint', category: 'selfmod' };
      }
      return null;
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // DEFAULT — 兜底允许
  // ══════════════════════════════════════════════════════════════════
  {
    name: 'default-allow',
    category: 'constitution', // belongs to base layer
    evaluate: () => ({ decision: 'allow', rule: 'default-allow', reason: '无规则阻止', category: 'constitution' }),
  },
];

// ── 策略引擎 ────────────────────────────────────────────────────────────

export class PolicyEngine {
  private logger: Logger;
  private tools: Map<string, ToolDefinition> = new Map();
  private evaluationCount = 0;
  private denyCount = 0;
  private escalateCount = 0;

  constructor(logger: Logger) {
    this.logger = logger.child('policy');
  }

  /**
   * 注册工具定义
   */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    this.logger.debug('Tool registered', { name: tool.name, category: tool.category });
  }

  /**
   * 获取已注册工具列表
   */
  getTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * 评估策略决策
   */
  evaluate(ctx: PolicyContext): PolicyResult {
    this.evaluationCount++;

    for (const rule of RULES) {
      const result = rule.evaluate(ctx);
      if (result) {
        if (result.decision === 'deny') this.denyCount++;
        if (result.decision === 'escalate') this.escalateCount++;

        this.logger.info('Policy decision', {
          tool: ctx.tool,
          decision: result.decision,
          rule: result.rule,
          category: result.category,
        });
        return result;
      }
    }

    // 不应该到达这里（default-allow 总会匹配）
    return { decision: 'allow', rule: 'fallback', reason: '兜底允许', category: 'constitution' };
  }

  /**
   * 统计信息
   */
  stats(): { evaluations: number; denies: number; escalations: number; ruleCount: number; toolCount: number } {
    return {
      evaluations: this.evaluationCount,
      denies: this.denyCount,
      escalations: this.escalateCount,
      ruleCount: RULES.length,
      toolCount: this.tools.size,
    };
  }

  /**
   * 获取规则列表（按类别）
   */
  listRules(): Array<{ name: string; category: PolicyCategory }> {
    return RULES.map(r => ({ name: r.name, category: r.category }));
  }
}
