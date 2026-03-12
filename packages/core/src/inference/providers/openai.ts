/**
 * OpenAI Provider — GPT-4o / GPT-4-turbo / o-series
 */
import type { Message } from '../../types/common.js';
import type { InferenceProvider, ChatOptions, StreamChunk } from '../../types/inference.js';
import { Cents } from '../../types/common.js';

// ── 定价表 (per 1M tokens, in cents) ─────────────────────────────────
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o':             { input: 250,  output: 1000 },
  'gpt-4o-mini':        { input: 15,   output: 60 },
  'gpt-4-turbo':        { input: 1000, output: 3000 },
  'gpt-4':              { input: 3000, output: 6000 },
  'gpt-3.5-turbo':      { input: 50,   output: 150 },
  'o1':                 { input: 1500, output: 6000 },
  'o1-mini':            { input: 300,  output: 1200 },
  'o3-mini':            { input: 110,  output: 440 },
};

export function createOpenAIProvider(apiKey: string, baseUrl = 'https://api.openai.com/v1'): InferenceProvider {
  return {
    id: 'openai',
    name: 'OpenAI',

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
          ...(m.name && { name: m.name }),
        })),
        stream: true,
        stream_options: { include_usage: true },
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens }),
        ...(options.tools && { tools: options.tools }),
      };

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`);
      }
      if (!res.body) throw new Error('OpenAI: no response body');

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
          if (payload === '[DONE]') {
            yield { type: 'done' };
            return;
          }
          try {
            const chunk = JSON.parse(payload) as {
              choices?: Array<{
                delta?: { content?: string; tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> };
                finish_reason?: string | null;
              }>;
              usage?: { prompt_tokens: number; completion_tokens: number };
            };

            const delta = chunk.choices?.[0]?.delta;

            // Text content
            if (delta?.content) {
              yield { type: 'text', text: delta.content };
            }

            // Tool calls
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.id && tc.function?.name) {
                  yield {
                    type: 'tool_call',
                    toolCall: {
                      id: tc.id,
                      name: tc.function.name,
                      arguments: tc.function.arguments ?? '',
                    },
                  };
                }
              }
            }

            // Usage (sent with final chunk when stream_options.include_usage is true)
            if (chunk.usage) {
              const model = options.model;
              yield {
                type: 'usage',
                usage: {
                  inputTokens: chunk.usage.prompt_tokens,
                  outputTokens: chunk.usage.completion_tokens,
                  cost: estimateCostInternal(model, chunk.usage.prompt_tokens, chunk.usage.completion_tokens),
                },
              };
            }
          } catch {
            // skip unparseable lines
          }
        }
      }
    },

    async listModels(): Promise<string[]> {
      const res = await fetch(`${baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!res.ok) return Object.keys(PRICING);
      const data = await res.json() as { data: Array<{ id: string }> };
      return data.data.map(m => m.id).filter(id => id.startsWith('gpt-') || id.startsWith('o'));
    },

    estimateCost: estimateCostInternal,
  };
}

function estimateCostInternal(model: string, inputTokens: number, outputTokens: number): Cents {
  const pricing = PRICING[model] ?? PRICING['gpt-4o-mini']!;
  const costCents = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  return Cents(costCents);
}
