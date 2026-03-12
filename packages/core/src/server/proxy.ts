/**
 * CLIProxy — OpenAI兼容API
 *
 * 使Cursor/Continue/Cline等工具可连接ConShell
 *
 * 端点:
 * - POST /v1/chat/completions
 * - GET /v1/models
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpServer } from './http.js';
import type { InferenceRouter } from '../inference/index.js';
import type { Logger } from '../types/common.js';

export function registerProxyRoutes(server: HttpServer, router: InferenceRouter, logger: Logger): void {
  const log = logger.child('proxy');

  // GET /v1/models — 模型列表 (OpenAI格式)
  server.get('/v1/models', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
    const models = router.listProviders().map(id => ({
      id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'conshell',
    }));

    server.sendJson(res, 200, { object: 'list', data: models });
  });

  // POST /v1/chat/completions — OpenAI兼容聊天
  server.post('/v1/chat/completions', async (_req: IncomingMessage, res: ServerResponse, body: string) => {
    try {
      const req = JSON.parse(body) as {
        model?: string;
        messages?: Array<{ role: string; content: string }>;
        temperature?: number;
        max_tokens?: number;
        stream?: boolean;
      };

      if (!req.messages?.length) {
        server.sendJson(res, 400, { error: { message: 'Missing messages', type: 'invalid_request_error' } });
        return;
      }

      const messages = req.messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      }));

      const model = req.model ?? 'default';
      log.info('Proxy chat request', { model, messageCount: messages.length, stream: req.stream });

      if (req.stream) {
        // SSE streaming
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        const chatId = `chatcmpl-${Date.now()}`;
        const stream = router.chat(messages, {
          model,
          temperature: req.temperature,
          maxTokens: req.max_tokens,
        });

        for await (const chunk of stream) {
          if (chunk.type === 'text' && chunk.text) {
            const sseData = {
              id: chatId,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{
                index: 0,
                delta: { content: chunk.text },
                finish_reason: null,
              }],
            };
            res.write(`data: ${JSON.stringify(sseData)}\n\n`);
          } else if (chunk.type === 'done') {
            const doneData = {
              id: chatId,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{
                index: 0,
                delta: {},
                finish_reason: 'stop',
              }],
            };
            res.write(`data: ${JSON.stringify(doneData)}\n\n`);
            res.write('data: [DONE]\n\n');
          }
        }

        res.end();
      } else {
        // Non-streaming: collect full response
        let fullText = '';
        let inputTokens = 0;
        let outputTokens = 0;

        const stream = router.chat(messages, {
          model,
          temperature: req.temperature,
          maxTokens: req.max_tokens,
        });

        for await (const chunk of stream) {
          if (chunk.type === 'text' && chunk.text) {
            fullText += chunk.text;
          } else if (chunk.type === 'usage' && chunk.usage) {
            inputTokens = chunk.usage.inputTokens;
            outputTokens = chunk.usage.outputTokens;
          }
        }

        server.sendJson(res, 200, {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{
            index: 0,
            message: { role: 'assistant', content: fullText },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
            total_tokens: inputTokens + outputTokens,
          },
        });
      }
    } catch (err) {
      log.error('Proxy error', { error: String(err) });
      server.sendJson(res, 500, { error: { message: 'Internal error', type: 'internal_error' } });
    }
  });
}
