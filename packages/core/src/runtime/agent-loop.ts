/**
 * ReAct Agent Loop — Think → Act → Observe → Persist
 *
 * 核心循环：
 * 1. Think: 组装系统提示(SOUL+宪法+余额+记忆) → 调用InferenceRouter
 * 2. Act:   解析tool_calls → ToolExecutor执行
 * 3. Observe: 收集结果 → 反馈给LLM
 * 4. Persist: 写TurnsRepo + 更新Memory
 *
 * 支持流式输出 + session-isolated context + EvoMap进化资产发布
 *
 * Round 12: session-aware processing — each session gets its own
 * hot buffer in MemoryTierManager while sharing warm/cold long-term memory.
 */
import type { Logger, Message, ToolCallRequest } from '../types/common.js';
import type { StreamChunk } from '../types/inference.js';
import type { InferenceRouter } from '../inference/index.js';
import type { ToolExecutor } from './tool-executor.js';
import type { MemoryTierManager, MemoryContext } from '../memory/tier-manager.js';
import type { SoulSystem } from '../soul/system.js';
import type { ConversationService } from '../channels/webchat/conversation-service.js';
import type { SelfState } from '../identity/continuity-service.js';
import type { SpendTracker } from '../spend/index.js';
import type { EconomicStateService } from '../economic/economic-state-service.js';
import { extractBehaviorGuidance, renderBehaviorGuidance } from './behavior-guidance.js';

/** Minimal kernel surface consumed by AgentLoop for session lifecycle */
export interface SessionLifecycleHost {
  startSession(sessionId: string): void;
  /** Optional: advance continuity + run consolidation after a turn completes */
  checkpointTurn?(sessionId: string): void;
}

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
  sessionId: string;
  userMessage: string;
  assistantResponse: string;
  toolCalls: ToolCallRequest[];
  toolResults: string[];
  iterations: number;
  totalTokens: number;
  durationMs: number;
}

/** Streaming chunk emitted by processMessageStream */
export interface AgentStreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error';
  /** For type='text': incremental text content */
  text?: string;
  /** For type='tool_call': tool call info */
  toolCall?: ToolCallRequest;
  /** For type='tool_result': tool execution result */
  toolResult?: { name: string; content: string; isError: boolean };
  /** For type='done': complete turn record */
  turn?: TurnRecord;
  /** For type='error': error message */
  error?: string;
}

// ── AgentLoop ─────────────────────────────────────────────────────────

const DEFAULT_SESSION = '__default__';

export class AgentLoop {
  private logger: Logger;
  private router: InferenceRouter;
  private toolExecutor: ToolExecutor;
  private memory: MemoryTierManager;
  private soul: SoulSystem;
  private conversationService: ConversationService | null;
  private opts: Required<AgentLoopOptions>;
  private _turnCount = 0;

  /** Kernel reference for session lifecycle integration */
  private _lifecycleHost: SessionLifecycleHost | null = null;
  /** Sessions already registered via startSession — prevents double-registration */
  private _knownSessions = new Set<string>();
  /** Optional SelfState for behavior guidance (Round 15.2) */
  private _selfState: SelfState | null = null;
  /** Optional SpendTracker for economic grounding (Round 15.3) */
  private _spendTracker: SpendTracker | null = null;
  /** Optional EconomicStateService for survival gate + value routing (Round 15.7B) */
  private _economicService: EconomicStateService | null = null;

  constructor(
    router: InferenceRouter,
    toolExecutor: ToolExecutor,
    memory: MemoryTierManager,
    soul: SoulSystem,
    logger: Logger,
    opts?: AgentLoopOptions,
    conversationService?: ConversationService,
  ) {
    this.logger = logger.child('agent-loop');
    this.router = router;
    this.toolExecutor = toolExecutor;
    this.memory = memory;
    this.soul = soul;
    this.conversationService = conversationService ?? null;
    this.opts = {
      maxIterations: opts?.maxIterations ?? 10,
      defaultModel: opts?.defaultModel ?? 'gpt-4o',
      onStream: opts?.onStream ?? (() => {}),
      onTurnComplete: opts?.onTurnComplete ?? (() => {}),
    };
  }

  /**
   * Wire a Kernel (or any SessionLifecycleHost) for automatic session tracking.
   * Once set, processMessage() will call host.startSession() on the first
   * message received for each new sessionId — making session lifecycle
   * a production runtime fact, not just a kernel-level ability.
   */
  setLifecycleHost(host: SessionLifecycleHost): void {
    this._lifecycleHost = host;
  }

  /**
   * Wire SelfState for identity-aware behavior guidance (Round 15.2).
   * When set, behavior guidance will include continuity signals.
   */
  setSelfState(state: SelfState): void {
    this._selfState = state;
  }

  /**
   * Wire SpendTracker for economic grounding (Round 15.3).
   * When set, each inference call records spend with session/turn attribution.
   */
  setSpendTracker(tracker: SpendTracker): void {
    this._spendTracker = tracker;
  }

  /**
   * Wire EconomicStateService for survival gate + value routing (Round 15.7B).
   * When set, each inference cycle is gated by survival tier enforcement.
   */
  setEconomicService(service: EconomicStateService): void {
    this._economicService = service;
  }

  /**
   * 处理一轮用户输入 (完整ReAct循环)
   * @param userMessage - 用户消息
   * @param sessionId  - 会话标识 (隔离 hot buffer 上下文)
   */
  async processMessage(userMessage: string, sessionId?: string): Promise<string> {
    const sid = sessionId ?? DEFAULT_SESSION;
    const startTime = Date.now();
    const turnId = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this._turnCount++;

    this.logger.info('Processing message', { turn: this._turnCount, sessionId: sid });

    // 0a. Session lifecycle integration — register new sessions with Kernel
    if (this._lifecycleHost && !this._knownSessions.has(sid)) {
      this._knownSessions.add(sid);
      this._lifecycleHost.startSession(sid);
      this.logger.debug('Session registered via lifecycle host', { sessionId: sid });
    }

    // 0a.5 Round 15.7B: Survival gate — hard-block if economic state forbids inference
    if (this._economicService) {
      const gate = this._economicService.getGateDecision(this.opts.defaultModel);
      this.logger.info('Survival gate', { action: gate.action, tier: gate.tier, health: gate.health });

      if (!gate.allowed) {
        const blockMsg = `[Survival Gate] ${gate.reason}`;
        this.memory.pushHot(sid, 'assistant', blockMsg);
        return blockMsg;
      }

      // If restricted, override the default model
      if (gate.action === 'restrict' && gate.suggestedModel) {
        this.logger.info('Survival gate: model restriction', { from: this.opts.defaultModel, to: gate.suggestedModel });
        // Store the override for this turn — don't mutate opts permanently
        // The model will be used in the inference call below
      }
    }

    // 0b. 推入 session-scoped 记忆
    this.memory.pushHot(sid, 'user', userMessage);

    // 1. 构建上下文
    const memCtx = this.memory.buildContext();
    const systemPrompt = this.buildSystemPrompt(memCtx);

    // 2. 构建对话历史 — prefer ConversationService for persistent context
    let messages: Message[];
    if (this.conversationService && sessionId) {
      messages = this.conversationService.buildContext(sessionId, { systemPrompt });
      // If conversation service has no history yet (first turn), add current message
      if (messages.length <= 1) { // only system prompt or empty
        messages.push({ role: 'user', content: userMessage });
      }
    } else {
      // Fallback to hot buffer
      messages = [
        { role: 'system', content: systemPrompt },
        ...this.memory.getHot(sid).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];
    }


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
          // Round 15.3: Record spend with attribution
          if (this._spendTracker && chunk.usage.cost != null) {
            this._spendTracker.recordSpend(
              'inference',
              chunk.usage.cost as unknown as number,
              {
                model: this.opts.defaultModel,
                category: 'inference',
                description: `iter:${iterations} in:${chunk.usage.inputTokens} out:${chunk.usage.outputTokens}`,
                sessionId: sid,
                turnId,
              },
            );
          }
        }
      }


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
    this.memory.pushHot(sid, 'assistant', finalResponse);

    // 存储事件到 episodic
    this.memory.storeEpisode('conversation', `User: ${userMessage.slice(0, 100)} → Agent: ${finalResponse.slice(0, 100)}`, 0.5, sid);

    const turn: TurnRecord = {
      sessionId: sid,
      userMessage,
      assistantResponse: finalResponse,
      toolCalls: allToolCalls,
      toolResults: allToolResults,
      iterations,
      totalTokens,
      durationMs: Date.now() - startTime,
    };

    this.opts.onTurnComplete(turn);

    // Round 15.0.2: checkpoint turn — advance continuity + consolidation
    this._lifecycleHost?.checkpointTurn?.(sid);

    this.logger.info('Message processed', {
      turn: this._turnCount,
      sessionId: sid,
      iterations,
      toolCallCount: allToolCalls.length,
      responseLength: finalResponse.length,
      durationMs: turn.durationMs,
    });

    return finalResponse;
  }

  /**
   * Streaming version — yields AgentStreamEvents for real-time delivery.
   * Used by Gateway to emit WS chunks during agent processing.
   */
  async *processMessageStream(userMessage: string, sessionId?: string): AsyncGenerator<AgentStreamEvent> {
    const sid = sessionId ?? DEFAULT_SESSION;
    const startTime = Date.now();
    const turnId = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this._turnCount++;

    this.logger.info('Processing message (stream)', { turn: this._turnCount, sessionId: sid });

    // 0. Push user message to session-scoped hot buffer
    this.memory.pushHot(sid, 'user', userMessage);

    // 1. Build context
    const memCtx = this.memory.buildContext();
    const systemPrompt = this.buildSystemPrompt(memCtx);

    let messages: Message[];
    if (this.conversationService && sessionId) {
      messages = this.conversationService.buildContext(sessionId, { systemPrompt });
      if (messages.length <= 1) {
        messages.push({ role: 'user', content: userMessage });
      }
    } else {
      messages = [
        { role: 'system', content: systemPrompt },
        ...this.memory.getHot(sid).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];
    }

    // 2. ReAct loop with streaming
    let iterations = 0;
    let finalResponse = '';
    const allToolCalls: ToolCallRequest[] = [];
    const allToolResults: string[] = [];
    let totalTokens = 0;



    try {
      while (iterations < this.opts.maxIterations) {
        iterations++;

        let fullText = '';
        const pendingToolCalls: ToolCallRequest[] = [];

        const stream = this.router.chat(messages, {
          model: this.opts.defaultModel,
          tools: this.toolExecutor.getToolDefinitions(),
        });

        for await (const chunk of stream) {
          if (chunk.type === 'text' && chunk.text) {
            fullText += chunk.text;
            yield { type: 'text' as const, text: chunk.text };
          } else if (chunk.type === 'tool_call' && chunk.toolCall) {
            const tc: ToolCallRequest = {
              id: chunk.toolCall.id,
              name: chunk.toolCall.name,
              arguments: chunk.toolCall.arguments,
            };
            pendingToolCalls.push(tc);
            yield { type: 'tool_call' as const, toolCall: tc };
          } else if (chunk.type === 'usage' && chunk.usage) {
            totalTokens += chunk.usage.inputTokens + chunk.usage.outputTokens;
            // Round 15.3: Record spend with attribution
            if (this._spendTracker && chunk.usage.cost != null) {
              this._spendTracker.recordSpend(
                'inference',
                chunk.usage.cost as unknown as number,
                {
                  model: this.opts.defaultModel,
                  category: 'inference',
                  description: `stream iter:${iterations} in:${chunk.usage.inputTokens} out:${chunk.usage.outputTokens}`,
                  sessionId: sid,
                  turnId,
                },
              );
            }
          }
        }



        if (pendingToolCalls.length === 0) {
          finalResponse = fullText;
          break;
        }

        // Execute tools
        allToolCalls.push(...pendingToolCalls);
        const results = await this.toolExecutor.executeMany(pendingToolCalls);
        const resultTexts = results.map(r => r.content);
        allToolResults.push(...resultTexts);

        // Yield tool results
        for (const result of results) {
          yield {
            type: 'tool_result' as const,
            toolResult: { name: result.name, content: result.content, isError: result.isError },
          };
        }

        // Update messages for next iteration
        messages.push({
          role: 'assistant',
          content: fullText || '[tool_calls]',
          toolCalls: pendingToolCalls,
        });
        for (const result of results) {
          messages.push({
            role: 'tool',
            content: result.content,
            toolCallId: result.toolCallId,
            name: result.name,
          });
        }
      }

      // Persist
      this.memory.pushHot(sid, 'assistant', finalResponse);
      this.memory.storeEpisode('conversation', `User: ${userMessage.slice(0, 100)} → Agent: ${finalResponse.slice(0, 100)}`, 0.5, sid);

      const turn: TurnRecord = {
        sessionId: sid,
        userMessage,
        assistantResponse: finalResponse,
        toolCalls: allToolCalls,
        toolResults: allToolResults,
        iterations,
        totalTokens,
        durationMs: Date.now() - startTime,
      };

      this.opts.onTurnComplete(turn);

      // P2-2: advance continuity chain after each processed turn
      this._lifecycleHost?.checkpointTurn?.(sid);

      yield { type: 'done' as const, turn };

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error('Agent loop stream error', { sessionId: sid, error: errMsg });
      yield { type: 'error' as const, error: errMsg };
      throw err;
    }
  }

  /** 构建系统提示 */
  private buildSystemPrompt(memCtx: MemoryContext): string {
    const parts: string[] = [];

    // 身份
    parts.push(this.soul.buildIdentityPrompt());
    parts.push('');

    // Round 15.2.1: Behavior Guidance — episodes OR selfState triggers rendering
    // Continuity guidance is a first-class source, not gated behind episodes
    const hasEpisodes = memCtx.structuredEpisodes && memCtx.structuredEpisodes.length > 0;
    const hasSelfState = !!this._selfState;
    if (hasEpisodes || hasSelfState) {
      const guidance = extractBehaviorGuidance(memCtx.structuredEpisodes ?? [], this._selfState);
      const rendered = renderBehaviorGuidance(guidance);
      if (rendered) {
        parts.push(rendered);
        parts.push('');
      }
    }

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

    // Round 15.1.2: event_type-based categorized episode rendering
    if (memCtx.recentEpisodes.length > 0) {
      const lessons: string[] = [];
      const preferences: string[] = [];
      const observations: string[] = [];

      for (const ep of memCtx.recentEpisodes) {
        // Extract event_type from the [event_type] prefix tag
        const tagMatch = ep.match(/^\[([^\]]+)\]/);
        const tag = tagMatch ? tagMatch[1]!.toLowerCase() : '';

        if (tag.startsWith('lesson') || tag.startsWith('error') || tag.startsWith('consolidated_tool')) {
          lessons.push(ep);
        } else if (tag.startsWith('preference') || tag.startsWith('config')) {
          preferences.push(ep);
        } else {
          observations.push(ep);
        }
      }

      if (lessons.length > 0) {
        parts.push('## 🔄 经验教训');
        parts.push(...lessons);
        parts.push('');
      }
      if (preferences.length > 0) {
        parts.push('## ⚡ 偏好设定');
        parts.push(...preferences);
        parts.push('');
      }
      if (observations.length > 0) {
        parts.push('## 📝 近期观察');
        parts.push(...observations);
        parts.push('');
      }
    }

    // Round 15.1.2: echo context — low-priority supplementary references
    if (memCtx.echoContext && memCtx.echoContext.length > 0) {
      parts.push('## 📎 补充参考（可能与摘要重复）');
      parts.push(...memCtx.echoContext);
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
