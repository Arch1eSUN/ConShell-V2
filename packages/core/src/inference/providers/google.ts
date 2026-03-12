/**
 * Google Gemini Provider — Gemini 2.5 Pro / Flash / 2.0
 */
import type { Message } from '../../types/common.js';
import type { InferenceProvider, ChatOptions, StreamChunk } from '../../types/inference.js';
import { Cents } from '../../types/common.js';

const PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-pro':     { input: 125, output: 1000 },
  'gemini-2.5-flash':   { input: 15,  output: 60 },
  'gemini-2.0-flash':   { input: 10,  output: 40 },
  'gemini-1.5-pro':     { input: 125, output: 500 },
  'gemini-1.5-flash':   { input: 8,   output: 30 },
};

const DEFAULT_MODEL = 'gemini-2.5-flash';

export function createGoogleProvider(apiKey: string): InferenceProvider {
  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  return {
    id: 'google',
    name: 'Google',

    async *chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk> {
      const model = options.model || DEFAULT_MODEL;

      // Convert messages to Gemini format
      const systemInstruction = messages
        .filter(m => m.role === 'system')
        .map(m => m.content)
        .join('\n\n');

      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

      const body: Record<string, unknown> = {
        contents,
        ...(systemInstruction && { systemInstruction: { parts: [{ text: systemInstruction }] } }),
        generationConfig: {
          ...(options.temperature !== undefined && { temperature: options.temperature }),
          ...(options.maxTokens !== undefined && { maxOutputTokens: options.maxTokens }),
        },
        ...(options.tools && {
          tools: [{
            functionDeclarations: options.tools.map(t => ({
              name: t.function.name,
              description: t.function.description,
              parameters: t.function.parameters,
            })),
          }],
        }),
      };

      const res = await fetch(
        `${baseUrl}/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Google ${res.status}: ${errText.slice(0, 200)}`);
      }
      if (!res.body) throw new Error('Google: no response body');

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
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;

          try {
            const chunk = JSON.parse(payload) as {
              candidates?: Array<{
                content?: { parts?: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }> };
                finishReason?: string;
              }>;
              usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
            };

            const parts = chunk.candidates?.[0]?.content?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.text) {
                  yield { type: 'text', text: part.text };
                }
                if (part.functionCall) {
                  yield {
                    type: 'tool_call',
                    toolCall: {
                      id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                      name: part.functionCall.name,
                      arguments: JSON.stringify(part.functionCall.args),
                    },
                  };
                }
              }
            }

            if (chunk.usageMetadata) {
              totalInputTokens = chunk.usageMetadata.promptTokenCount;
              totalOutputTokens = chunk.usageMetadata.candidatesTokenCount;
            }

            if (chunk.candidates?.[0]?.finishReason === 'STOP') {
              if (totalInputTokens || totalOutputTokens) {
                yield {
                  type: 'usage',
                  usage: {
                    inputTokens: totalInputTokens,
                    outputTokens: totalOutputTokens,
                    cost: estimateCostInternal(model, totalInputTokens, totalOutputTokens),
                  },
                };
              }
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
