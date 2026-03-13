/**
 * AgentLoop Tests — session isolation, streaming, tool execution
 *
 * Round 12: Validates session-scoped processing, hot buffer isolation,
 * processMessageStream generator, and tool call integration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentLoop } from './agent-loop.js';
import type { ToolExecutor } from './tool-executor.js';
import type { InferenceRouter } from '../inference/index.js';
import type { MemoryTierManager, MemoryContext } from '../memory/tier-manager.js';
import type { SoulSystem } from '../soul/system.js';
import type { StreamChunk } from '../types/inference.js';
import type { AgentStreamEvent } from './agent-loop.js';

// ── Helpers ───────────────────────────────────────────────────────────

function makeLogger() {
  return {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: () => makeLogger(),
  } as any;
}

function makeSoul(): SoulSystem {
  return {
    buildIdentityPrompt: () => 'You are a test agent.',
    current: { name: 'TestBot' },
  } as any;
}

/**
 * Create a mock MemoryTierManager that tracks per-session hot buffers.
 */
function makeMemory(): MemoryTierManager & {
  _hotBuffers: Map<string, Array<{ role: string; content: string }>>;
  _episodes: Array<{ eventType: string; content: string; sessionId?: string }>;
} {
  const hotBuffers = new Map<string, Array<{ role: string; content: string }>>();
  const episodes: Array<{ eventType: string; content: string; sessionId?: string }> = [];

  return {
    _hotBuffers: hotBuffers,
    _episodes: episodes,
    pushHot(sessionId: string, role: string, content: string) {
      let buf = hotBuffers.get(sessionId);
      if (!buf) { buf = []; hotBuffers.set(sessionId, buf); }
      buf.push({ role, content });
    },
    getHot(sessionId: string) {
      return hotBuffers.get(sessionId) ?? [];
    },
    clearHot(sessionId?: string) {
      if (sessionId) hotBuffers.delete(sessionId);
      else hotBuffers.clear();
    },
    buildContext(): MemoryContext {
      return {
        sessionSummaries: [],
        relevantFacts: [],
        relationships: [],
        recentEpisodes: [],
        skills: [],
        estimatedTokens: 0,
      };
    },
    storeEpisode(eventType: string, content: string, importanceOrScore?: number, sessionId?: string) {
      episodes.push({ eventType, content, sessionId });
    },
    storeFact: vi.fn(),
    storeRelationship: vi.fn(),
    storeProcedure: vi.fn(),
    saveSessionSummary: vi.fn(),
    saveSoulSnapshot: vi.fn(),
    stats: () => ({ hotSize: 0, soulVersions: 0 }),
  } as any;
}

/**
 * Create a mock InferenceRouter that yields predefined chunks.
 */
function makeRouter(chunks: StreamChunk[]): InferenceRouter {
  return {
    chat: async function* () {
      for (const c of chunks) yield c;
    },
    chatStreaming: async function* () {
      for (const c of chunks) yield c;
    },
    stats: () => ({ providerCount: 1, requestCount: 0, totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0, survivalTier: 'thriving', primaryProvider: 'mock' }),
  } as any;
}

/**
 * Create a mock ToolExecutor with optional registered tools.
 */
function makeToolExecutor(tools?: Record<string, (args: any) => Promise<string>>): ToolExecutor {
  const toolMap = new Map(Object.entries(tools ?? {}));
  return {
    listTools: () => Array.from(toolMap.keys()),
    getToolDefinitions: () => Array.from(toolMap.entries()).map(([name]) => ({
      type: 'function' as const,
      function: { name, description: '', parameters: {} },
    })),
    executeMany: async (calls: any[]) => calls.map(c => {
      const fn = toolMap.get(c.name);
      return {
        toolCallId: c.id,
        name: c.name,
        content: fn ? 'ok' : `Error: Tool "${c.name}" not found`,
        isError: !fn,
      };
    }),
    executeOne: async (call: any) => {
      const fn = toolMap.get(call.name);
      return {
        toolCallId: call.id,
        name: call.name,
        content: fn ? await fn(JSON.parse(call.arguments || '{}')) : `Error: Tool "${call.name}" not found`,
        isError: !fn,
      };
    },
    registerTool: vi.fn(),
    registerTools: vi.fn(),
    stats: () => ({ executionCount: 0, errorCount: 0, registeredTools: toolMap.size }),
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('AgentLoop', () => {
  let memory: ReturnType<typeof makeMemory>;
  let soul: ReturnType<typeof makeSoul>;
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(() => {
    memory = makeMemory();
    soul = makeSoul();
    logger = makeLogger();
  });

  describe('processMessage (non-streaming)', () => {
    it('should return assistant response from inference', async () => {
      const router = makeRouter([
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world!' },
      ]);
      const executor = makeToolExecutor();
      const loop = new AgentLoop(router, executor, memory, soul, logger);

      const result = await loop.processMessage('Hi there', 'session-1');
      expect(result).toBe('Hello world!');
    });

    it('should increment turn count', async () => {
      const router = makeRouter([{ type: 'text', text: 'ok' }]);
      const loop = new AgentLoop(router, makeToolExecutor(), memory, soul, logger);

      expect(loop.turnCount).toBe(0);
      await loop.processMessage('test', 'sess-1');
      expect(loop.turnCount).toBe(1);
      await loop.processMessage('test2', 'sess-1');
      expect(loop.turnCount).toBe(2);
    });

    it('should use __default__ session when no sessionId provided', async () => {
      const router = makeRouter([{ type: 'text', text: 'ok' }]);
      const loop = new AgentLoop(router, makeToolExecutor(), memory, soul, logger);

      await loop.processMessage('test');
      expect(memory._hotBuffers.has('__default__')).toBe(true);
      expect(memory._hotBuffers.get('__default__')!.length).toBe(2); // user + assistant
    });
  });

  describe('session isolation', () => {
    it('should isolate hot buffers between sessions', async () => {
      const router = makeRouter([{ type: 'text', text: 'reply-A' }]);
      const executor = makeToolExecutor();
      const loop = new AgentLoop(router, executor, memory, soul, logger);

      await loop.processMessage('msg from A', 'session-A');

      // Create new router for session B (to get different reply)
      const routerB = makeRouter([{ type: 'text', text: 'reply-B' }]);
      const loopB = new AgentLoop(routerB, executor, memory, soul, logger);
      await loopB.processMessage('msg from B', 'session-B');

      // Verify isolation
      const hotA = memory._hotBuffers.get('session-A')!;
      const hotB = memory._hotBuffers.get('session-B')!;

      expect(hotA).toBeDefined();
      expect(hotB).toBeDefined();

      // Session A should only contain A's messages
      expect(hotA.some(m => m.content === 'msg from A')).toBe(true);
      expect(hotA.some(m => m.content === 'msg from B')).toBe(false);

      // Session B should only contain B's messages
      expect(hotB.some(m => m.content === 'msg from B')).toBe(true);
      expect(hotB.some(m => m.content === 'msg from A')).toBe(false);
    });

    it('should share long-term memory (episodes) between sessions', async () => {
      const router = makeRouter([{ type: 'text', text: 'ok' }]);
      const loop = new AgentLoop(router, makeToolExecutor(), memory, soul, logger);

      await loop.processMessage('hello', 'session-A');
      await loop.processMessage('world', 'session-B');

      // Both sessions should store episodes to the same global episodic memory
      expect(memory._episodes.length).toBe(2);
      expect(memory._episodes[0].sessionId).toBe('session-A');
      expect(memory._episodes[1].sessionId).toBe('session-B');
    });

    it('should not leak context between concurrent sessions', async () => {
      // Simulate interleaved usage
      const router = makeRouter([{ type: 'text', text: 'r' }]);
      const loop = new AgentLoop(router, makeToolExecutor(), memory, soul, logger);

      await loop.processMessage('A1', 'A');
      await loop.processMessage('B1', 'B');
      await loop.processMessage('A2', 'A');

      const hotA = memory._hotBuffers.get('A')!;
      const hotB = memory._hotBuffers.get('B')!;

      // A should have: A1, r (from first), A2, r (from third)
      expect(hotA.filter(m => m.role === 'user').map(m => m.content)).toEqual(['A1', 'A2']);
      // B should have: B1, r (from second)
      expect(hotB.filter(m => m.role === 'user').map(m => m.content)).toEqual(['B1']);
      // B must NOT contain any A messages
      expect(hotB.some(m => m.content.includes('A'))).toBe(false);
    });
  });

  describe('processMessageStream', () => {
    it('should yield text events', async () => {
      const router = makeRouter([
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world!' },
      ]);
      const loop = new AgentLoop(router, makeToolExecutor(), memory, soul, logger);

      const events: AgentStreamEvent[] = [];
      for await (const event of loop.processMessageStream('test', 'sess-1')) {
        events.push(event);
      }

      const textEvents = events.filter(e => e.type === 'text');
      expect(textEvents.length).toBe(2);
      expect(textEvents[0].text).toBe('Hello ');
      expect(textEvents[1].text).toBe('world!');

      const doneEvent = events.find(e => e.type === 'done');
      expect(doneEvent).toBeDefined();
      expect(doneEvent!.turn!.assistantResponse).toBe('Hello world!');
      expect(doneEvent!.turn!.sessionId).toBe('sess-1');
    });

    it('should yield tool_call and tool_result events', async () => {
      // First call: LLM emits tool_call → next call: LLM emits text
      let callCount = 0;
      const router = {
        chat: async function* () {
          callCount++;
          if (callCount === 1) {
            yield { type: 'tool_call', toolCall: { id: 'tc1', name: 'test_tool', arguments: '{}' } } as StreamChunk;
          } else {
            yield { type: 'text', text: 'After tool' } as StreamChunk;
          }
        },
      } as any;

      const executor = makeToolExecutor({ test_tool: async () => 'tool_result_value' });
      const loop = new AgentLoop(router, executor, memory, soul, logger);

      const events: AgentStreamEvent[] = [];
      for await (const event of loop.processMessageStream('do something', 'sess-1')) {
        events.push(event);
      }

      expect(events.some(e => e.type === 'tool_call')).toBe(true);
      expect(events.some(e => e.type === 'tool_result')).toBe(true);
      expect(events.some(e => e.type === 'text' && e.text === 'After tool')).toBe(true);
    });
  });

  describe('with ConversationService', () => {
    it('should use ConversationService for context when available', async () => {
      const mockConv = {
        buildContext: vi.fn().mockReturnValue([
          { role: 'system', content: 'system' },
          { role: 'user', content: 'prev msg' },
          { role: 'assistant', content: 'prev reply' },
          { role: 'user', content: 'current' },
        ]),
        appendTurn: vi.fn(),
      } as any;

      const router = makeRouter([{ type: 'text', text: 'ok' }]);
      const loop = new AgentLoop(
        router, makeToolExecutor(), memory, soul, logger,
        undefined, mockConv,
      );

      await loop.processMessage('current', 'sess-1');
      expect(mockConv.buildContext).toHaveBeenCalledWith('sess-1', expect.objectContaining({ systemPrompt: expect.any(String) }));
    });
  });
});
