/**
 * Ollama Provider — 本地LLM推理
 * Uses Ollama REST API (no API key required)
 */
import type { Message } from '../../types/common.js';
import type { InferenceProvider, ChatOptions, StreamChunk } from '../../types/inference.js';
import { Cents, ZERO_CENTS } from '../../types/common.js';

export function createOllamaProvider(baseUrl = 'http://localhost:11434'): InferenceProvider {
  return {
    id: 'ollama',
    name: 'Ollama',

    async *chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk> {
      const body: Record<string, unknown> = {
        model: options.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
        ...(options.temperature !== undefined && { options: { temperature: options.temperature } }),
        ...(options.maxTokens !== undefined && { options: { num_predict: options.maxTokens } }),
        ...(options.tools && {
          tools: options.tools.map(t => ({
            type: 'function',
            function: {
              name: t.function.name,
              description: t.function.description,
              parameters: t.function.parameters,
            },
          })),
        }),
      };

      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Ollama ${res.status}: ${errText.slice(0, 200)}`);
      }
      if (!res.body) throw new Error('Ollama: no response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line) as {
              message?: {
                content?: string;
                tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>;
              };
              done?: boolean;
              prompt_eval_count?: number;
              eval_count?: number;
            };

            if (chunk.message?.content) {
              yield { type: 'text', text: chunk.message.content };
            }

            if (chunk.message?.tool_calls) {
              for (const tc of chunk.message.tool_calls) {
                yield {
                  type: 'tool_call',
                  toolCall: {
                    id: `ollama_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    name: tc.function.name,
                    arguments: JSON.stringify(tc.function.arguments),
                  },
                };
              }
            }

            if (chunk.prompt_eval_count) totalInputTokens = chunk.prompt_eval_count;
            if (chunk.eval_count) totalOutputTokens = chunk.eval_count;

            if (chunk.done) {
              yield {
                type: 'usage',
                usage: {
                  inputTokens: totalInputTokens,
                  outputTokens: totalOutputTokens,
                  cost: ZERO_CENTS, // local = free
                },
              };
              yield { type: 'done' };
              return;
            }
          } catch {
            // skip
          }
        }
      }
    },

    async listModels(): Promise<string[]> {
      try {
        const res = await fetch(`${baseUrl}/api/tags`);
        if (!res.ok) return [];
        const data = await res.json() as { models: Array<{ name: string }> };
        return data.models.map(m => m.name);
      } catch {
        return [];
      }
    },

    estimateCost(_model: string, _inputTokens: number, _outputTokens: number): Cents {
      return ZERO_CENTS; // local inference is free
    },
  };
}
