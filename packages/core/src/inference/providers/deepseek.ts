/**
 * DeepSeek Provider — DeepSeek-V3 / DeepSeek-R1
 * Uses OpenAI-compatible API
 */
import type { Message } from '../../types/common.js';
import type { InferenceProvider, ChatOptions, StreamChunk } from '../../types/inference.js';
import { Cents } from '../../types/common.js';

const PRICING: Record<string, { input: number; output: number }> = {
  'deepseek-chat':     { input: 14,  output: 28 },   // V3
  'deepseek-reasoner': { input: 55,  output: 219 },  // R1
};

const BASE_URL = 'https://api.deepseek.com/v1';

export function createDeepSeekProvider(apiKey: string): InferenceProvider {
  return {
    id: 'deepseek',
    name: 'DeepSeek',

    async *chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk> {
      const body: Record<string, unknown> = {
        model: options.model || 'deepseek-chat',
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
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`DeepSeek ${res.status}: ${errText.slice(0, 200)}`);
      }
      if (!res.body) throw new Error('DeepSeek: no response body');

      yield* parseOpenAIStream(res.body, options.model || 'deepseek-chat');
    },

    async listModels(): Promise<string[]> {
      return Object.keys(PRICING);
    },

    estimateCost(model: string, inputTokens: number, outputTokens: number): Cents {
      const pricing = PRICING[model] ?? PRICING['deepseek-chat']!;
      return Cents((inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000);
    },
  };
}

// Shared OpenAI-compatible SSE stream parser
async function* parseOpenAIStream(body: ReadableStream<Uint8Array>, model: string): AsyncGenerator<StreamChunk> {
  const reader = body.getReader();
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
          usage?: { prompt_tokens: number; completion_tokens: number };
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
          const pricing = PRICING[model] ?? PRICING['deepseek-chat']!;
          yield {
            type: 'usage',
            usage: {
              inputTokens: chunk.usage.prompt_tokens,
              outputTokens: chunk.usage.completion_tokens,
              cost: Cents((chunk.usage.prompt_tokens * pricing.input + chunk.usage.completion_tokens * pricing.output) / 1_000_000),
            },
          };
        }
      } catch { /* skip */ }
    }
  }
}
