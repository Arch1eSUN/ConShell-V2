/**
 * 推理相关类型
 */
import type { Cents, Message } from './common.js';

/** 聊天选项 */
export interface ChatOptions {
  readonly model: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly tools?: ToolSchema[];
  readonly systemPrompt?: string;
  readonly stream?: boolean;
}

/** 工具 Schema (给LLM看的) */
export interface ToolSchema {
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
  };
}

/** 流式输出块 */
export interface StreamChunk {
  readonly type: 'text' | 'tool_call' | 'usage' | 'done';
  readonly text?: string;
  readonly toolCall?: {
    readonly id: string;
    readonly name: string;
    readonly arguments: string;
  };
  readonly usage?: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cost: Cents;
  };
}

/** 推理Provider接口 */
export interface InferenceProvider {
  readonly id: string;
  readonly name: string;

  /** 发起聊天推理 */
  chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk>;

  /** 列出可用模型 */
  listModels(): Promise<string[]>;

  /** 估算推理成本 */
  estimateCost(model: string, inputTokens: number, outputTokens: number): Cents;
}
