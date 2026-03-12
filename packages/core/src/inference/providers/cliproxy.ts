/**
 * CLIProxy Provider — 通过 CLIProxyAPI 复用 Cursor/Continue 等 IDE 的 API key
 * Uses OpenAI-compatible format
 */
import type { Message } from '../../types/common.js';
import type { InferenceProvider, ChatOptions, StreamChunk } from '../../types/inference.js';
import { Cents, ZERO_CENTS } from '../../types/common.js';

export function createCLIProxyProvider(baseUrl: string, apiKey: string): InferenceProvider {
  return {
    id: 'cliproxy',
    name: 'CLIProxy',

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

      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`CLIProxy ${res.status}: ${errText.slice(0, 200)}`);
      }
      if (!res.body) throw new Error('CLIProxy: no response body');

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
              yield {
                type: 'usage',
                usage: {
                  inputTokens: chunk.usage.prompt_tokens,
                  outputTokens: chunk.usage.completion_tokens,
                  cost: ZERO_CENTS, // CLIProxy = piggyback on IDE subscription
                },
              };
            }
          } catch { /* skip */ }
        }
      }
    },

    async listModels(): Promise<string[]> {
      try {
        const res = await fetch(`${baseUrl}/v1/models`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        if (!res.ok) return [];
        const data = await res.json() as { data: Array<{ id: string }> };
        return data.data.map(m => m.id);
      } catch {
        return [];
      }
    },

    estimateCost(_model: string, _inputTokens: number, _outputTokens: number): Cents {
      return ZERO_CENTS; // CLIProxy uses IDE subscription, no direct cost
    },
  };
}
