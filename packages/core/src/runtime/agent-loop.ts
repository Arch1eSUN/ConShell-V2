/**
 * ReAct Agent Loop — Think → Act → Observe → Persist
 *
 * 核心循环：
 * 1. Think: 组装系统提示(SOUL+宪法+余额+记忆) → 调用InferenceRouter
 * 2. Act:   解析tool_calls → ToolExecutor执行
 * 3. Observe: 收集结果 → 反馈给LLM
 * 4. Persist: 写TurnsRepo + 更新Memory
 *
 * 支持流式输出 + EvoMap进化资产发布
 */
import type { Logger, Message, ToolCallRequest } from '../types/common.js';
import type { StreamChunk } from '../types/inference.js';
import type { InferenceRouter } from '../inference/index.js';
import type { ToolExecutor } from './tool-executor.js';
import type { MemoryTierManager, MemoryContext } from '../memory/tier-manager.js';
import type { SoulSystem } from '../soul/system.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface AgentLoopOptions {
  /** 最大循环次数 (防止无限循环), 默认 10 */
  maxIterations?: number;
  /** 默认模型名称 */
  defaultModel?: string;
  /** 流式输出回调 */
  onStream?: (chunk: StreamChunk) => void;
  /** 每轮结束持久化回调 */
  onTurnComplete?: (turn: TurnRecord) => void;
}

export interface TurnRecord {
  userMessage: string;
  assistantResponse: string;
  toolCalls: ToolCallRequest[];
  toolResults: string[];
  iterations: number;
  totalTokens: number;
  durationMs: number;
}

// ── AgentLoop ─────────────────────────────────────────────────────────

export class AgentLoop {
  private logger: Logger;
  private router: InferenceRouter;
  private toolExecutor: ToolExecutor;
  private memory: MemoryTierManager;
  private soul: SoulSystem;
  private opts: Required<AgentLoopOptions>;
  private _turnCount = 0;

  constructor(
    router: InferenceRouter,
    toolExecutor: ToolExecutor,
    memory: MemoryTierManager,
    soul: SoulSystem,
    logger: Logger,
    opts?: AgentLoopOptions,
  ) {
    this.logger = logger.child('agent-loop');
    this.router = router;
    this.toolExecutor = toolExecutor;
    this.memory = memory;
    this.soul = soul;
    this.opts = {
      maxIterations: opts?.maxIterations ?? 10,
      defaultModel: opts?.defaultModel ?? 'gpt-4o',
      onStream: opts?.onStream ?? (() => {}),
      onTurnComplete: opts?.onTurnComplete ?? (() => {}),
    };
  }

  /**
   * 处理一轮用户输入 (完整ReAct循环)
   */
  async processMessage(userMessage: string): Promise<string> {
    const startTime = Date.now();
    this._turnCount++;

    this.logger.info('Processing message', { turn: this._turnCount });

    // 0. 推入记忆
    this.memory.pushHot('user', userMessage);

    // 1. 构建上下文
    const memCtx = this.memory.buildContext();
    const systemPrompt = this.buildSystemPrompt(memCtx);

    // 2. 构建对话历史
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...this.memory.getHot().map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    // 3. ReAct 循环
    let iterations = 0;
    let finalResponse = '';
    const allToolCalls: ToolCallRequest[] = [];
    const allToolResults: string[] = [];
    let totalTokens = 0;

    while (iterations < this.opts.maxIterations) {
      iterations++;

      // Think: 调用LLM
      let fullText = '';
      const pendingToolCalls: ToolCallRequest[] = [];

      const stream = this.router.chat(messages, {
        model: this.opts.defaultModel,
        tools: this.toolExecutor.getToolDefinitions(),
      });

      for await (const chunk of stream) {
        if (chunk.type === 'text' && chunk.text) {
          fullText += chunk.text;
          this.opts.onStream(chunk);
        } else if (chunk.type === 'tool_call' && chunk.toolCall) {
          pendingToolCalls.push({
            id: chunk.toolCall.id,
            name: chunk.toolCall.name,
            arguments: chunk.toolCall.arguments,
          });
        } else if (chunk.type === 'usage' && chunk.usage) {
          totalTokens += chunk.usage.inputTokens + chunk.usage.outputTokens;
        }
      }

      // 如果没有tool_calls → 对话结束
      if (pendingToolCalls.length === 0) {
        finalResponse = fullText;
        break;
      }

      // Act: 执行工具
      this.logger.debug('Executing tools', { count: pendingToolCalls.length });
      allToolCalls.push(...pendingToolCalls);

      const results = await this.toolExecutor.executeMany(pendingToolCalls);
      const resultTexts = results.map(r => r.content);
      allToolResults.push(...resultTexts);

      // Observe: 将工具结果加入消息
      // 先加入assistant的tool_call消息
      messages.push({
        role: 'assistant',
        content: fullText || '[tool_calls]',
        toolCalls: pendingToolCalls,
      });

      // 再加入每个工具结果 (作为tool角色)
      for (const result of results) {
        messages.push({
          role: 'tool',
          content: result.content,
          toolCallId: result.toolCallId,
          name: result.name,
        });
      }
    }

    // 4. Persist
    this.memory.pushHot('assistant', finalResponse);

    // 存储事件到 episodic
    this.memory.storeEpisode('conversation', `User: ${userMessage.slice(0, 100)} → Agent: ${finalResponse.slice(0, 100)}`, 0.5);

    const turn: TurnRecord = {
      userMessage,
      assistantResponse: finalResponse,
      toolCalls: allToolCalls,
      toolResults: allToolResults,
      iterations,
      totalTokens,
      durationMs: Date.now() - startTime,
    };

    this.opts.onTurnComplete(turn);

    this.logger.info('Message processed', {
      turn: this._turnCount,
      iterations,
      toolCallCount: allToolCalls.length,
      responseLength: finalResponse.length,
      durationMs: turn.durationMs,
    });

    return finalResponse;
  }

  /** 构建系统提示 */
  private buildSystemPrompt(memCtx: MemoryContext): string {
    const parts: string[] = [];

    // 身份
    parts.push(this.soul.buildIdentityPrompt());
    parts.push('');

    // 记忆上下文
    if (memCtx.sessionSummaries.length > 0) {
      parts.push('## Recent Session Summaries');
      parts.push(...memCtx.sessionSummaries);
      parts.push('');
    }

    if (memCtx.relevantFacts.length > 0) {
      parts.push('## Known Facts');
      parts.push(...memCtx.relevantFacts);
      parts.push('');
    }

    if (memCtx.relationships.length > 0) {
      parts.push('## Known Relationships');
      parts.push(...memCtx.relationships);
      parts.push('');
    }

    if (memCtx.skills.length > 0) {
      parts.push('## Learned Skills');
      parts.push(...memCtx.skills);
      parts.push('');
    }

    // 可用工具提示
    parts.push('## Available Tools');
    parts.push(`You have access to: ${this.toolExecutor.listTools().join(', ')}`);
    parts.push('Use tools when you need to take actions or gather information.');

    return parts.join('\n');
  }

  get turnCount(): number {
    return this._turnCount;
  }
}
