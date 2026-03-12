/**
 * OpenRouter Provider — 多模型聚合（100+ 模型，统一 API）
 * Uses OpenAI-compatible API with OpenRouter-specific headers
 */
import type { Message } from '../../types/common.js';
import type { InferenceProvider, ChatOptions, StreamChunk } from '../../types/inference.js';
import { Cents } from '../../types/common.js';

const BASE_URL = 'https://openrouter.ai/api/v1';

// OpenRouter pricing varies by model; use their API to get costs
const KNOWN_PRICING: Record<string, { input: number; output: number }> = {
  'openai/gpt-4o':                 { input: 250,  output: 1000 },
  'openai/gpt-4o-mini':            { input: 15,   output: 60 },
  'anthropic/claude-sonnet-4':     { input: 300,  output: 1500 },
  'anthropic/claude-3.5-haiku':    { input: 80,   output: 400 },
  'google/gemini-2.5-flash':       { input: 15,   output: 60 },
  'deepseek/deepseek-chat':        { input: 14,   output: 28 },
  'meta-llama/llama-3.1-70b':      { input: 50,   output: 50 },
  'qwen/qwen-2.5-72b':            { input: 35,   output: 40 },
};

export function createOpenRouterProvider(apiKey: string): InferenceProvider {
  return {
    id: 'openrouter',
    name: 'OpenRouter',

    async *chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk> {
      const body: Record<string, unknown> = {
        model: options.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          ...(m.toolCalls && { tool_calls: m.toolCalls.map(tc => ({
            id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments },
          })) }),
          ...(m.toolCallId && { tool_call_id: m.toolCallId }),
        })),
        stream: true,
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens }),
        ...(options.tools && { tools: options.tools }),
      };

      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://conshell.ai',
          'X-Title': 'ConShell V2',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 200)}`);
      }
      if (!res.body) throw new Error('OpenRouter: no response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') { yield { type: 'done' }; return; }
          try {
            const chunk = JSON.parse(payload) as {
              choices?: Array<{
                delta?: { content?: string; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> };
                finish_reason?: string | null;
              }>;
              usage?: { prompt_tokens: number; completion_tokens: number; total_cost?: number };
            };

            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) yield { type: 'text', text: delta.content };
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.id && tc.function?.name) {
                  yield { type: 'tool_call', toolCall: { id: tc.id, name: tc.function.name, arguments: tc.function.arguments ?? '' } };
                }
              }
            }
            if (chunk.usage) {
              yield {
                type: 'usage',
                usage: {
                  inputTokens: chunk.usage.prompt_tokens,
                  outputTokens: chunk.usage.completion_tokens,
                  cost: chunk.usage.total_cost
                    ? Cents(chunk.usage.total_cost * 100) // total_cost is in USD
                    : estimateCostInternal(options.model, chunk.usage.prompt_tokens, chunk.usage.completion_tokens),
                },
              };
            }
          } catch { /* skip */ }
        }
      }
    },

    async listModels(): Promise<string[]> {
      try {
        const res = await fetch(`${BASE_URL}/models`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        if (!res.ok) return Object.keys(KNOWN_PRICING);
        const data = await res.json() as { data: Array<{ id: string }> };
        return data.data.map(m => m.id).slice(0, 100); // cap at 100
      } catch {
        return Object.keys(KNOWN_PRICING);
      }
    },

    estimateCost: estimateCostInternal,
  };
}

function estimateCostInternal(model: string, inputTokens: number, outputTokens: number): Cents {
  const pricing = KNOWN_PRICING[model] ?? { input: 50, output: 50 }; // fallback mid-tier
  return Cents((inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000);
}
