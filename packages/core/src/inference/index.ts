/**
 * 推理路由器 — 多Provider LLM统一接入
 * 
 * SurvivalTier感知路由 + Failover + 成本追踪
 */
import type { Cents, Logger, Message } from '../types/common.js';
import type { InferenceProvider, ChatOptions, StreamChunk } from '../types/inference.js';
import type { AppConfig } from '../types/config.js';
import { ZERO_CENTS, addCents } from '../types/common.js';

// Re-export providers
export {
  createOpenAIProvider,
  createAnthropicProvider,
  createGoogleProvider,
  createDeepSeekProvider,
  createOllamaProvider,
  createOpenRouterProvider,
  createCLIProxyProvider,
} from './providers/index.js';

// ── SurvivalTier ──────────────────────────────────────────────────────

export type SurvivalTier = 'thriving' | 'comfortable' | 'surviving' | 'critical' | 'dead';

// ── InferenceRouter ───────────────────────────────────────────────────

export class InferenceRouter {
  private providers = new Map<string, InferenceProvider>();
  private primary: string | null = null;
  private logger: Logger;
  private survivalTier: SurvivalTier = 'thriving';
  private fallbackChain: string[] = [];
  private _totalCost: Cents = ZERO_CENTS;
  private _totalInputTokens = 0;
  private _totalOutputTokens = 0;
  private _requestCount = 0;

  constructor(logger: Logger) {
    this.logger = logger.child('inference');
  }

  /** 注册推理Provider */
  register(provider: InferenceProvider): void {
    this.providers.set(provider.id, provider);
    if (!this.primary) this.primary = provider.id;
    this.logger.info('Provider registered', { id: provider.id, name: provider.name });
  }

  /** 设置主Provider */
  setPrimary(id: string): void {
    if (!this.providers.has(id)) throw new Error(`Provider "${id}" not registered`);
    this.primary = id;
    this.logger.info('Primary provider set', { id });
  }

  /** 设置fallback链 */
  setFallbackChain(chain: string[]): void {
    this.fallbackChain = chain.filter(id => this.providers.has(id));
    this.logger.info('Fallback chain set', { chain: this.fallbackChain });
  }

  /** 更新SurvivalTier */
  updateSurvivalTier(tier: SurvivalTier): void {
    if (this.survivalTier !== tier) {
      this.logger.info('SurvivalTier changed', { from: this.survivalTier, to: tier });
      this.survivalTier = tier;
    }
  }

  /** 获取指定Provider */
  getProvider(id?: string): InferenceProvider {
    const key = id ?? this.primary;
    if (!key || !this.providers.has(key)) {
      throw new Error(`No provider available: ${key ?? 'none registered'}`);
    }
    return this.providers.get(key)!;
  }

  /** 按SurvivalTier选择最优Provider */
  private selectProvider(): InferenceProvider {
    switch (this.survivalTier) {
      case 'dead':
        throw new Error('Agent survival tier is DEAD — no inference available');

      case 'critical': {
        const ollama = this.providers.get('ollama');
        if (ollama) return ollama;
        this.logger.warn('Critical tier but no Ollama — falling back to primary');
        return this.getProvider();
      }

      case 'surviving': {
        for (const id of this.fallbackChain) {
          const p = this.providers.get(id);
          if (p) return p;
        }
        const ollama = this.providers.get('ollama');
        if (ollama) return ollama;
        return this.getProvider();
      }

      default:
        return this.getProvider();
    }
  }

  /** 列出所有Provider ID */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * 流式聊天 — 核心方法
   * 返回 AsyncIterable<StreamChunk>，自动追踪成本
   */
  async *chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk> {
    const provider = this.selectProvider();
    this._requestCount++;
    this.logger.debug('Chat request', { provider: provider.id, model: options.model, tier: this.survivalTier });

    try {
      for await (const chunk of provider.chat(messages, options)) {
        // Intercept usage chunks to track costs
        if (chunk.type === 'usage' && chunk.usage) {
          this._totalInputTokens += chunk.usage.inputTokens;
          this._totalOutputTokens += chunk.usage.outputTokens;
          this._totalCost = addCents(this._totalCost, chunk.usage.cost);
        }
        yield chunk;
      }
    } catch (err) {
      // Failover: try fallback chain
      this.logger.warn('Provider failed, attempting failover', { provider: provider.id, error: String(err) });
      const fallbackProvider = this.findFallback(provider.id);
      if (!fallbackProvider) throw err;

      this.logger.info('Failover to', { provider: fallbackProvider.id });
      for await (const chunk of fallbackProvider.chat(messages, options)) {
        if (chunk.type === 'usage' && chunk.usage) {
          this._totalInputTokens += chunk.usage.inputTokens;
          this._totalOutputTokens += chunk.usage.outputTokens;
          this._totalCost = addCents(this._totalCost, chunk.usage.cost);
        }
        yield chunk;
      }
    }
  }

  /**
   * 流式聊天（安全模式）— 用于面向用户的 streaming path
   *
   * 与 chat() 的区别：
   * - 首个 text chunk 之前: 允许 failover 到备用 provider
   * - 首个 text chunk 之后: 禁止 mid-stream failover，直接 throw
   *   （避免把坏前缀 + fallback 输出拼成用户可见结果）
   */
  async *chatStreaming(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk> {
    const provider = this.selectProvider();
    this._requestCount++;
    this.logger.debug('ChatStreaming request', { provider: provider.id, model: options.model });

    let hasYieldedText = false;

    try {
      for await (const chunk of provider.chat(messages, options)) {
        if (chunk.type === 'usage' && chunk.usage) {
          this._totalInputTokens += chunk.usage.inputTokens;
          this._totalOutputTokens += chunk.usage.outputTokens;
          this._totalCost = addCents(this._totalCost, chunk.usage.cost);
        }
        if (chunk.type === 'text' && chunk.text) {
          hasYieldedText = true;
        }
        yield chunk;
      }
    } catch (err) {
      if (hasYieldedText) {
        // Already sent text to user — cannot silently stitch fallback output
        this.logger.error('Mid-stream failure after text yield — no fallback allowed', {
          provider: provider.id,
          error: String(err),
        });
        throw err;
      }

      // Pre-first-token failure — allow failover
      this.logger.warn('Pre-token failure, attempting failover', {
        provider: provider.id,
        error: String(err),
      });
      const fallbackProvider = this.findFallback(provider.id);
      if (!fallbackProvider) throw err;

      this.logger.info('Failover to', { provider: fallbackProvider.id });
      for await (const chunk of fallbackProvider.chat(messages, options)) {
        if (chunk.type === 'usage' && chunk.usage) {
          this._totalInputTokens += chunk.usage.inputTokens;
          this._totalOutputTokens += chunk.usage.outputTokens;
          this._totalCost = addCents(this._totalCost, chunk.usage.cost);
        }
        yield chunk;
      }
    }
  }

  /**
   * 非流式聊天 — 收集完整响应
   */
  async chatComplete(messages: Message[], options: ChatOptions): Promise<{
    text: string;
    toolCalls: Array<{ id: string; name: string; arguments: string }>;
    usage?: { inputTokens: number; outputTokens: number; cost: Cents };
  }> {
    let text = '';
    const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];
    let usage: { inputTokens: number; outputTokens: number; cost: Cents } | undefined;

    for await (const chunk of this.chat(messages, options)) {
      switch (chunk.type) {
        case 'text':
          text += chunk.text ?? '';
          break;
        case 'tool_call':
          if (chunk.toolCall) toolCalls.push(chunk.toolCall);
          break;
        case 'usage':
          if (chunk.usage) usage = chunk.usage;
          break;
      }
    }

    return { text, toolCalls, usage };
  }

  /** 找一个可用的fallback */
  private findFallback(excludeId: string): InferenceProvider | null {
    for (const id of this.fallbackChain) {
      if (id !== excludeId && this.providers.has(id)) return this.providers.get(id)!;
    }
    for (const [id, provider] of this.providers) {
      if (id !== excludeId) return provider;
    }
    return null;
  }

  /** 推理统计 */
  stats(): {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: Cents;
    requestCount: number;
    survivalTier: SurvivalTier;
    primaryProvider: string | null;
    providerCount: number;
  } {
    return {
      totalInputTokens: this._totalInputTokens,
      totalOutputTokens: this._totalOutputTokens,
      totalCost: this._totalCost,
      requestCount: this._requestCount,
      survivalTier: this.survivalTier,
      primaryProvider: this.primary,
      providerCount: this.providers.size,
    };
  }
}

// ── 从配置初始化推理路由器 ─────────────────────────────────────────────

export function setupInferenceRouter(config: AppConfig, logger: Logger): InferenceRouter {
  // Dynamic imports are used at call site — caller passes pre-created providers
  const router = new InferenceRouter(logger);
  logger.info('Inference router created (providers must be registered separately)');
  return router;
}
