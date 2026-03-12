/**
 * 核心共享类型
 */

// ── Branded Money ──────────────────────────────────────────────────────

declare const CentsBrand: unique symbol;

/**
 * Cents — 最小货币单位（1 cent = $0.01）。
 * 使用 branded type 防止裸数字与金额混淆。
 */
export type Cents = number & { readonly [CentsBrand]: true };

/** 创建 Cents 值（四舍五入到整数） */
export const Cents = (n: number): Cents => Math.round(n) as Cents;

/** 零值 */
export const ZERO_CENTS = Cents(0);

/** 加法 */
export const addCents = (a: Cents, b: Cents): Cents => Cents(a + b);

/** 减法 */
export const subCents = (a: Cents, b: Cents): Cents => Cents(a - b);

// ── Agent 状态 ─────────────────────────────────────────────────────────

/** Agent 生命周期状态 */
export type AgentState = 'setup' | 'waking' | 'running' | 'sleeping' | 'dead';

/** 生存等级 */
export type SurvivalTier = 'normal' | 'frugal' | 'critical' | 'terminal';

/** 安全等级 */
export type SecurityLevel = 'sandbox' | 'standard' | 'autonomous' | 'godmode';

// ── 消息与工具 ─────────────────────────────────────────────────────────

/** 对话消息 */
export interface Message {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly toolCalls?: ToolCallRequest[];
  readonly toolCallId?: string;
  readonly name?: string;
}

/** LLM 发出的工具调用请求 */
export interface ToolCallRequest {
  readonly id: string;
  readonly name: string;
  readonly arguments: string; // JSON字符串
}

/** 工具执行结果 */
export interface ToolResult {
  readonly toolCallId: string;
  readonly name: string;
  readonly content: string;
  readonly isError: boolean;
}

/** 工具定义（注册到工具注册表） */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  readonly category: ToolCategory;
  readonly requiresApproval: boolean;
}

/** 工具类别 */
export type ToolCategory = 'web' | 'shell' | 'filesystem' | 'http' | 'browser' | 'skill' | 'x402';

// ── 日志 ───────────────────────────────────────────────────────────────

/** 日志接口 */
export interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
  child(name: string): Logger;
}
