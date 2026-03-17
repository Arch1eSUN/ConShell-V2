/**
 * 工具执行器 — 接收LLM tool_call → 执行 → 返回ToolResult
 *
 * 功能:
 * - 工具注册与查找
 * - 超时控制
 * - 经济生存门控 (Round 15.8)
 * - 结果截断
 * - 审计日志
 */
import type { Logger, ToolCallRequest, ToolResult } from '../types/common.js';
import type { SurvivalTier } from '../automaton/index.js';
import type { EconomicPolicy, CostClass, RuntimeMode } from '../economic/economic-policy.js';
import { resolveRuntimeMode } from '../economic/economic-policy.js';
import type { EconomicStateService } from '../economic/economic-state-service.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface ToolHandler {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 执行函数 */
  execute: (args: Record<string, unknown>) => Promise<string>;
  /** Cost classification for economic gating (default: 'low') */
  costClass?: CostClass;
}

export interface ToolExecutorOptions {
  /** 每个工具的超时时间(ms), 默认30000 */
  timeoutMs?: number;
  /** 结果最大字符数, 默认 4096 */
  maxResultLength?: number;
}

// ── ToolExecutor ──────────────────────────────────────────────────────

export class ToolExecutor {
  private tools = new Map<string, ToolHandler>();
  private logger: Logger;
  private opts: Required<ToolExecutorOptions>;
  private _executionCount = 0;
  private _errorCount = 0;
  private _blockedCount = 0;
  private _economicPolicy?: EconomicPolicy;
  private _economicService?: EconomicStateService;
  private _currentTier: SurvivalTier = 'normal';

  constructor(logger: Logger, opts?: ToolExecutorOptions) {
    this.logger = logger.child('tool-executor');
    this.opts = {
      timeoutMs: opts?.timeoutMs ?? 30_000,
      maxResultLength: opts?.maxResultLength ?? 4096,
    };
  }

  /** Inject EconomicPolicy for survival gate on tools */
  setEconomicPolicy(policy: EconomicPolicy): void {
    this._economicPolicy = policy;
    this.logger.info('Economic policy enabled for ToolExecutor');
  }

  /** Inject EconomicStateService for on-demand tier freshness (Round 15.9) */
  setEconomicService(service: EconomicStateService): void {
    this._economicService = service;
    this.logger.info('Economic service enabled for on-demand tier reads');
  }

  /** Update the current survival tier (called by Kernel/Heartbeat as fallback) */
  updateTier(tier: SurvivalTier): void {
    this._currentTier = tier;
  }

  /** 注册工具 */
  registerTool(handler: ToolHandler): void {
    this.tools.set(handler.name, handler);
    this.logger.debug('Tool registered', { name: handler.name });
  }

  /** 批量注册 */
  registerTools(handlers: ToolHandler[]): void {
    for (const h of handlers) this.registerTool(h);
  }

  /** 获取所有已注册工具名 */
  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /** 获取工具定义 (供LLM使用, 符合ToolSchema格式) */
  getToolDefinitions(): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
    return Array.from(this.tools.values()).map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: {},
      },
    }));
  }

  /**
   * 执行一组 tool calls
   * 返回对应的 ToolResult 数组
   */
  async executeMany(calls: ToolCallRequest[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    for (const call of calls) {
      const result = await this.executeOne(call);
      results.push(result);
    }
    return results;
  }

  /**
   * 执行单个 tool call
   * 返回标准 ToolResult {toolCallId, name, content, isError}
   */
  async executeOne(call: ToolCallRequest): Promise<ToolResult> {
    this._executionCount++;
    const startTime = Date.now();

    const handler = this.tools.get(call.name);
    if (!handler) {
      this._errorCount++;
      this.logger.warn('Tool not found', { name: call.name });
      return {
        toolCallId: call.id,
        name: call.name,
        content: `Error: Tool "${call.name}" not found. Available tools: ${this.listTools().join(', ')}`,
        isError: true,
      };
    }

    this.logger.debug('Executing tool', { name: call.name, id: call.id });

    // Round 15.9: On-demand tier freshness — read latest tier before gating
    if (this._economicService) {
      this._currentTier = this._economicService.getCurrentTier();
    }

    // RuntimeMode behavior contract (Round 15.9)
    const currentMode = resolveRuntimeMode(this._currentTier);
    if (currentMode === 'shutdown') {
      this._blockedCount++;
      this.logger.info('Tool blocked: shutdown mode', { name: call.name });
      return {
        toolCallId: call.id,
        name: call.name,
        content: `Tool "${call.name}" blocked: agent in shutdown mode — all operations blocked`,
        isError: true,
      };
    }

    // Economic gate: check if tool execution is allowed at current tier
    if (this._economicPolicy) {
      const costClass = handler.costClass ?? 'low';
      // survival-recovery mode: treat as more restrictive
      const effectiveTier: SurvivalTier = currentMode === 'survival-recovery'
        ? 'terminal'
        : this._currentTier;

      const decision = this._economicPolicy.evaluateAndRecord(
        'tool-executor',
        'tool',
        costClass,
        effectiveTier,
        `tool:${call.name} mode:${currentMode}`,
      );

      if (!decision.allowed) {
        this._blockedCount++;
        this.logger.info('Tool blocked by economic policy', {
          name: call.name, tier: effectiveTier, costClass, mode: currentMode, reason: decision.reason,
        });
        return {
          toolCallId: call.id,
          name: call.name,
          content: `Tool "${call.name}" blocked: ${decision.reason}`,
          isError: true,
        };
      }
    }

    try {
      // Parse arguments
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(call.arguments);
      } catch {
        args = {};
      }

      // Execute with timeout
      const output = await this.withTimeout(handler.execute(args), this.opts.timeoutMs);

      // Truncate if needed
      const truncated = output.length > this.opts.maxResultLength
        ? output.slice(0, this.opts.maxResultLength) + '\n... [truncated]'
        : output;

      const elapsed = Date.now() - startTime;
      this.logger.debug('Tool executed', { name: call.name, elapsed, outputLength: truncated.length });

      return { toolCallId: call.id, name: call.name, content: truncated, isError: false };
    } catch (err) {
      this._errorCount++;
      const elapsed = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error('Tool execution failed', { name: call.name, elapsed, error: errorMsg });

      return {
        toolCallId: call.id,
        name: call.name,
        content: `Error executing ${call.name}: ${errorMsg}`,
        isError: true,
      };
    }
  }

  /** 统计 */
  stats(): { executionCount: number; errorCount: number; blockedCount: number; registeredTools: number } {
    return {
      executionCount: this._executionCount,
      errorCount: this._errorCount,
      blockedCount: this._blockedCount,
      registeredTools: this.tools.size,
    };
  }

  // ── helpers ───────────────────────────────────────────────────────

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Tool timeout after ${ms}ms`)), ms);
      promise.then(
        result => { clearTimeout(timer); resolve(result); },
        err => { clearTimeout(timer); reject(err); },
      );
    });
  }
}
