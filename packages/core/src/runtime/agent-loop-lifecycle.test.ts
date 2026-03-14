/**
 * AgentLoop Session Lifecycle Integration Tests
 *
 * Round 14.8.2 — proves that processMessage() triggers kernel.startSession()
 * in real production code paths, not just kernel-level tests.
 *
 * What this file proves:
 *   1. First message for a session triggers startSession() on the lifecycle host
 *   2. Subsequent messages for the same session do NOT re-trigger startSession()
 *   3. Different sessions each get their own startSession() call
 *   4. Default session (__default__) also triggers startSession()
 *   5. Without lifecycle host, no crash — graceful no-op
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentLoop, type SessionLifecycleHost } from './agent-loop.js';
import type { MemoryTierManager, MemoryContext } from '../memory/tier-manager.js';
import type { SoulSystem } from '../soul/system.js';
import type { StreamChunk } from '../types/inference.js';

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

function makeMemory(): MemoryTierManager {
  const hotBuffers = new Map<string, Array<{ role: string; content: string }>>();
  return {
    pushHot(sessionId: string, role: string, content: string) {
      let buf = hotBuffers.get(sessionId);
      if (!buf) { buf = []; hotBuffers.set(sessionId, buf); }
      buf.push({ role, content });
    },
    getHot: (sid: string) => hotBuffers.get(sid) ?? [],
    clearHot: vi.fn(),
    buildContext(): MemoryContext {
      return {
        sessionSummaries: [], relevantFacts: [], relationships: [],
        recentEpisodes: [], skills: [], estimatedTokens: 0,
      };
    },
    storeEpisode: vi.fn(),
    storeFact: vi.fn(),
    storeRelationship: vi.fn(),
    storeProcedure: vi.fn(),
    saveSessionSummary: vi.fn(),
    saveSoulSnapshot: vi.fn(),
    stats: () => ({ hotSize: 0, soulVersions: 0 }),
  } as any;
}

function makeRouter() {
  return {
    chat: async function* () {
      yield { type: 'text', text: 'ok' } as StreamChunk;
    },
    chatStreaming: async function* () {
      yield { type: 'text', text: 'ok' } as StreamChunk;
    },
    stats: () => ({
      providerCount: 1, requestCount: 0, totalCost: 0,
      totalInputTokens: 0, totalOutputTokens: 0,
      survivalTier: 'thriving', primaryProvider: 'mock',
    }),
  } as any;
}

function makeToolExecutor() {
  return {
    listTools: () => [],
    getToolDefinitions: () => [],
    executeMany: async () => [],
    executeOne: async () => ({ toolCallId: '', name: '', content: '', isError: true }),
    registerTool: vi.fn(),
    registerTools: vi.fn(),
    stats: () => ({ executionCount: 0, errorCount: 0, registeredTools: 0 }),
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('AgentLoop — Session Lifecycle Integration (Round 14.8.2)', () => {
  let memory: MemoryTierManager;
  let logger: ReturnType<typeof makeLogger>;
  let host: SessionLifecycleHost;

  beforeEach(() => {
    memory = makeMemory();
    logger = makeLogger();
    host = { startSession: vi.fn() };
  });

  function buildLoop(): AgentLoop {
    const loop = new AgentLoop(
      makeRouter(), makeToolExecutor(), memory, makeSoul(), logger,
    );
    loop.setLifecycleHost(host);
    return loop;
  }

  // ── Goal A: production path triggers startSession ──

  it('calls startSession on first message for a session', async () => {
    const loop = buildLoop();
    await loop.processMessage('hello', 'sess-A');
    expect(host.startSession).toHaveBeenCalledWith('sess-A');
    expect(host.startSession).toHaveBeenCalledTimes(1);
  });

  it('does NOT re-trigger startSession for the same session', async () => {
    const loop = buildLoop();
    await loop.processMessage('msg1', 'sess-A');
    await loop.processMessage('msg2', 'sess-A');
    await loop.processMessage('msg3', 'sess-A');
    expect(host.startSession).toHaveBeenCalledTimes(1);
  });

  it('triggers startSession once per distinct session', async () => {
    const loop = buildLoop();
    await loop.processMessage('m1', 'sess-A');
    await loop.processMessage('m2', 'sess-B');
    await loop.processMessage('m3', 'sess-C');

    expect(host.startSession).toHaveBeenCalledTimes(3);
    expect(host.startSession).toHaveBeenCalledWith('sess-A');
    expect(host.startSession).toHaveBeenCalledWith('sess-B');
    expect(host.startSession).toHaveBeenCalledWith('sess-C');
  });

  it('triggers startSession for __default__ session too', async () => {
    const loop = buildLoop();
    await loop.processMessage('no session id');
    expect(host.startSession).toHaveBeenCalledWith('__default__');
  });

  it('works gracefully without lifecycle host', async () => {
    // No setLifecycleHost called — should not crash
    const loop = new AgentLoop(
      makeRouter(), makeToolExecutor(), memory, makeSoul(), logger,
    );
    const result = await loop.processMessage('hello', 'sess-X');
    expect(result).toBe('ok');
    // startSession was never wired, so no call
    expect(host.startSession).not.toHaveBeenCalled();
  });

  it('interleaved sessions each get exactly one startSession', async () => {
    const loop = buildLoop();
    await loop.processMessage('A1', 'A');
    await loop.processMessage('B1', 'B');
    await loop.processMessage('A2', 'A');
    await loop.processMessage('B2', 'B');
    await loop.processMessage('C1', 'C');

    expect(host.startSession).toHaveBeenCalledTimes(3);
  });
});
