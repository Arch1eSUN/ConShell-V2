/**
 * InferenceRouter Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { InferenceRouter } from './index.js';
import type { InferenceProvider, StreamChunk, ChatOptions } from '../types/inference.js';
import type { Message, Cents } from '../types/common.js';
import { ZERO_CENTS } from '../types/common.js';

const mockLogger = {
  debug: () => {}, info: () => {}, warn: () => {}, error: () => {},
  child: function() { return this; },
};

function makeProvider(id: string, responses: StreamChunk[] = []): InferenceProvider {
  return {
    id,
    name: `Provider ${id}`,
    async *chat(_msgs: Message[], _opts: ChatOptions) {
      for (const chunk of responses) yield chunk;
    },
    async listModels() { return ['test-model']; },
    estimateCost() { return ZERO_CENTS; },
  };
}

describe('InferenceRouter', () => {
  let router: InferenceRouter;

  beforeEach(() => {
    router = new InferenceRouter(mockLogger as any);
  });

  it('registers providers', () => {
    router.register(makeProvider('openai'));
    router.register(makeProvider('anthropic'));
    expect(router.listProviders()).toEqual(['openai', 'anthropic']);
  });

  it('sets first provider as primary', () => {
    router.register(makeProvider('openai'));
    expect(router.stats().primaryProvider).toBe('openai');
  });

  it('allows setting primary', () => {
    router.register(makeProvider('openai'));
    router.register(makeProvider('anthropic'));
    router.setPrimary('anthropic');
    expect(router.stats().primaryProvider).toBe('anthropic');
  });

  it('throws on unknown primary', () => {
    expect(() => router.setPrimary('nonexistent')).toThrow('not registered');
  });

  it('throws when no provider available', () => {
    expect(() => router.getProvider()).toThrow('No provider available');
  });

  it('updates survival tier', () => {
    router.updateSurvivalTier('critical');
    expect(router.stats().survivalTier).toBe('critical');
  });

  it('dead tier throws on chat', async () => {
    router.register(makeProvider('openai'));
    router.updateSurvivalTier('dead');
    const gen = async () => { for await (const _ of router.chat([], { model: 'gpt-4' })) { /* */ } };
    await expect(gen()).rejects.toThrow('DEAD');
  });

  it('streams text chunks', async () => {
    const chunks: StreamChunk[] = [
      { type: 'text', text: 'Hello ' },
      { type: 'text', text: 'world' },
    ];
    router.register(makeProvider('openai', chunks));

    const result: string[] = [];
    for await (const chunk of router.chat([], { model: 'gpt-4' })) {
      if (chunk.type === 'text') result.push(chunk.text!);
    }
    expect(result.join('')).toBe('Hello world');
  });

  it('chatComplete collects text', async () => {
    const chunks: StreamChunk[] = [
      { type: 'text', text: 'Hello' },
      { type: 'text', text: ' world' },
    ];
    router.register(makeProvider('openai', chunks));
    const result = await router.chatComplete([], { model: 'gpt-4' });
    expect(result.text).toBe('Hello world');
    expect(result.toolCalls).toHaveLength(0);
  });

  it('tracks usage and cost', async () => {
    const chunks: StreamChunk[] = [
      { type: 'text', text: 'Hi' },
      { type: 'usage', usage: { inputTokens: 100, outputTokens: 50, cost: 10 as Cents } },
    ];
    router.register(makeProvider('openai', chunks));
    await router.chatComplete([], { model: 'gpt-4' });

    const s = router.stats();
    expect(s.totalInputTokens).toBe(100);
    expect(s.totalOutputTokens).toBe(50);
    expect(s.requestCount).toBe(1);
  });

  it('sets fallback chain', () => {
    router.register(makeProvider('openai'));
    router.register(makeProvider('anthropic'));
    router.setFallbackChain(['anthropic', 'openai']);
    // No assertion needed — just ensure no errors
    expect(router.stats().providerCount).toBe(2);
  });

  it('critical tier prefers ollama', async () => {
    const mainChunks: StreamChunk[] = [{ type: 'text', text: 'main' }];
    const ollamaChunks: StreamChunk[] = [{ type: 'text', text: 'ollama' }];
    router.register(makeProvider('openai', mainChunks));
    router.register(makeProvider('ollama', ollamaChunks));
    router.updateSurvivalTier('critical');

    const result = await router.chatComplete([], { model: 'llama3' });
    expect(result.text).toBe('ollama');
  });

  it('handles mid-stream provider failure with failover', async () => {
    // Primary provider that fails mid-stream
    const failingProvider: InferenceProvider = {
      id: 'failing',
      name: 'Failing Provider',
      async *chat() {
        yield { type: 'text' as const, text: 'partial' };
        throw new Error('connection reset');
      },
      async listModels() { return ['model']; },
      estimateCost() { return ZERO_CENTS; },
    };

    // Fallback that works
    const fallbackChunks: StreamChunk[] = [
      { type: 'text', text: 'recovered' },
    ];

    router.register(failingProvider);
    router.register(makeProvider('fallback', fallbackChunks));
    router.setFallbackChain(['fallback']);

    const result = await router.chatComplete([], { model: 'test' });
    // chatComplete accumulates text from partial primary + full fallback
    expect(result.text).toBe('partialrecovered');
  });

  it('streams done chunk without error', async () => {
    const chunks: StreamChunk[] = [
      { type: 'text', text: 'Hi' },
      { type: 'done' },
    ];
    router.register(makeProvider('openai', chunks));

    const collected: StreamChunk[] = [];
    for await (const chunk of router.chat([], { model: 'gpt-4' })) {
      collected.push(chunk);
    }
    expect(collected).toHaveLength(2);
    expect(collected[0].type).toBe('text');
    expect(collected[1].type).toBe('done');
  });
});
