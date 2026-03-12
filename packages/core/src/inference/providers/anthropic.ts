/**
 * Anthropic Provider — Claude 3.5 / Claude 4 / Opus / Haiku
 */
import type { Message } from '../../types/common.js';
import type { InferenceProvider, ChatOptions, StreamChunk } from '../../types/inference.js';
import { Cents } from '../../types/common.js';

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514':  { input: 300,  output: 1500 },
  'claude-3-7-sonnet-latest':  { input: 300,  output: 1500 },
  'claude-3-5-sonnet-20241022': { input: 300, output: 1500 },
  'claude-3-5-haiku-20241022':  { input: 80,  output: 400 },
  'claude-3-opus-20240229':     { input: 1500, output: 7500 },
  'claude-3-haiku-20240307':    { input: 25,   output: 125 },
};

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export function createAnthropicProvider(apiKey: string): InferenceProvider {
  const baseUrl = 'https://api.anthropic.com/v1';

  return {
    id: 'anthropic',
    name: 'Anthropic',

    async *chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk> {
      // Anthropic uses 'system' as a top-level param, separate from messages
      const systemMessages = messages.filter(m => m.role === 'system');
      const nonSystemMessages = messages.filter(m => m.role !== 'system');

      const anthropicMessages = nonSystemMessages.map(m => {
        if (m.role === 'tool') {
          return {
            role: 'user' as const,
            content: [{
              type: 'tool_result' as const,
              tool_use_id: m.toolCallId ?? '',
              content: m.content,
            }],
          };
        }
        if (m.role === 'assistant' && m.toolCalls?.length) {
          return {
            role: 'assistant' as const,
            content: [
              ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
              ...m.toolCalls.map(tc => ({
                type: 'tool_use' as const,
                id: tc.id,
                name: tc.name,
                input: JSON.parse(tc.arguments || '{}'),
              })),
            ],
          };
        }
        return { role: m.role as 'user' | 'assistant', content: m.content };
      });

      const body: Record<string, unknown> = {
        model: options.model || DEFAULT_MODEL,
        max_tokens: options.maxTokens ?? 4096,
        messages: anthropicMessages,
        stream: true,
        ...(systemMessages.length > 0 && { system: systemMessages.map(m => m.content).join('\n\n') }),
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.tools && {
          tools: options.tools.map(t => ({
            name: t.function.name,
            description: t.function.description,
            input_schema: t.function.parameters,
          })),
        }),
      };

      const res = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 200)}`);
      }
      if (!res.body) throw new Error('Anthropic: no response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentToolUse: { id: string; name: string; argsBuffer: string } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;

          try {
            const event = JSON.parse(payload) as {
              type: string;
              delta?: { type: string; text?: string; partial_json?: string };
              content_block?: { type: string; id?: string; name?: string };
              message?: { usage?: { input_tokens: number; output_tokens: number } };
              usage?: { input_tokens?: number; output_tokens: number };
            };

            switch (event.type) {
              case 'content_block_start':
                if (event.content_block?.type === 'tool_use') {
                  currentToolUse = {
                    id: event.content_block.id ?? '',
                    name: event.content_block.name ?? '',
                    argsBuffer: '',
                  };
                }
                break;

              case 'content_block_delta':
                if (event.delta?.type === 'text_delta' && event.delta.text) {
                  yield { type: 'text', text: event.delta.text };
                }
                if (event.delta?.type === 'input_json_delta' && event.delta.partial_json && currentToolUse) {
                  currentToolUse.argsBuffer += event.delta.partial_json;
                }
                break;

              case 'content_block_stop':
                if (currentToolUse) {
                  yield {
                    type: 'tool_call',
                    toolCall: {
                      id: currentToolUse.id,
                      name: currentToolUse.name,
                      arguments: currentToolUse.argsBuffer,
                    },
                  };
                  currentToolUse = null;
                }
                break;

              case 'message_delta':
                if (event.usage) {
                  yield {
                    type: 'usage',
                    usage: {
                      inputTokens: event.usage.input_tokens ?? 0,
                      outputTokens: event.usage.output_tokens,
                      cost: estimateCostInternal(options.model || DEFAULT_MODEL, event.usage.input_tokens ?? 0, event.usage.output_tokens),
                    },
                  };
                }
                break;

              case 'message_stop':
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
      return Object.keys(PRICING);
    },

    estimateCost: estimateCostInternal,
  };
}

function estimateCostInternal(model: string, inputTokens: number, outputTokens: number): Cents {
  const pricing = PRICING[model] ?? PRICING[DEFAULT_MODEL]!;
  const costCents = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  return Cents(costCents);
}
