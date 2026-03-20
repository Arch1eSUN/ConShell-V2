/**
 * kernel-continuity.test.ts — Round 14.8.1 → Updated Round 15.0.2
 *
 * Tests the REAL RUNTIME WIRING between Kernel lifecycle methods
 * and the ContinuityService. This is NOT a service-level test —
 * it proves that:
 *
 * 1. Kernel.startSession() tracks session state
 * 2. Kernel.checkpointTurn() triggers real continuity advance
 * 3. Kernel.shutdown() calls checkpointTurn() before teardown
 * 4. Guard conditions (not hydrated, no state change) are honored
 *
 * Strategy: inject real DB + real ContinuityService via private
 * `services` field, mock only non-identity services.
 */
import { describe, it, expect, vi } from 'vitest';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../state/database.js';
import { ContinuityService } from '../identity/continuity-service.js';
import { Kernel } from './index.js';
import { MemoryTierManager } from '../memory/tier-manager.js';

// ── Silent logger ────────────────────────────────────────────────────
const noop = () => {};
const silentLogger = {
  info: noop, debug: noop, warn: noop, error: noop,
  child: () => silentLogger,
} as any;

const SOUL_CONTENT = `---
name: WiringTestAgent
tagline: Testing kernel wiring
personality: [precise]
values: [truth]
---
I am a test soul for kernel continuity wiring tests.
`;

// ── Helpers ──────────────────────────────────────────────────────────

function freshDb() {
  const agentHome = join(tmpdir(), `kernel-wiring-${randomUUID()}`);
  mkdirSync(agentHome, { recursive: true });
  return { db: openDatabase({ agentHome, logger: silentLogger }), agentHome };
}

/**
 * Creates a Kernel with real ContinuityService + DB injected,
 * but all other services stubbed to minimum viable mocks.
 */
function wireKernel({ db, agentHome }: ReturnType<typeof freshDb>, continuity: ContinuityService) {
  const kernel = new Kernel();

  // Real memory tier manager for episode counting
  const memory = new MemoryTierManager(db, silentLogger);

  // Inject services via type assertion to test real wiring
  (kernel as any).services = {
    logger: silentLogger,
    config: {},
    db,
    wallet: null,
    soul: { current: { raw: SOUL_CONTENT } },
    continuity,
    selfState: continuity.getCurrentState(),
    memory,
    inference: {},
    stateMachine: { transition: noop },
    agentLoop: {},
    toolExecutor: {},
    skills: {},
    heartbeat: { stop: noop },
    taskQueue: {},
    httpServer: { stop: () => Promise.resolve() },
    wsServer: {},
    evomap: null,
  };

  (kernel as any)._running = true;

  return kernel;
}

// ══════════════════════════════════════════════════════════════════════
// 1. startSession() tracks session state
// ══════════════════════════════════════════════════════════════════════
describe('Kernel.startSession() — session tracking', () => {
  it('increments sessionCount on each call', () => {
    const { db, agentHome } = freshDb();
    const continuity = new ContinuityService(db, silentLogger, agentHome);
    continuity.hydrate({ soulContent: SOUL_CONTENT, soulName: 'WiringTestAgent' });

    const kernel = wireKernel({db, agentHome} as any, continuity);

    expect(kernel.sessionCount).toBe(0);

    kernel.startSession('sess-1');
    expect(kernel.sessionCount).toBe(1);

    kernel.startSession('sess-2');
    expect(kernel.sessionCount).toBe(2);
  });

  it('records lastSessionId for checkpointTurn to use', () => {
    const { db, agentHome } = freshDb();
    const continuity = new ContinuityService(db, silentLogger, agentHome);
    continuity.hydrate({ soulContent: SOUL_CONTENT, soulName: 'WiringTestAgent' });

    const kernel = wireKernel({db, agentHome} as any, continuity);
    kernel.startSession('my-session-42');

    expect((kernel as any)._lastSessionId).toBe('my-session-42');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2. checkpointTurn() — real continuity advance (per-turn checkpoint)
// ══════════════════════════════════════════════════════════════════════
describe('Kernel.checkpointTurn() — runtime wiring', () => {
  it('advances continuity chain when session state differs from latest record', () => {
    const { db, agentHome } = freshDb();
    const continuity = new ContinuityService(db, silentLogger, agentHome);
    continuity.hydrate({ soulContent: SOUL_CONTENT, soulName: 'WiringTestAgent' });

    const kernel = wireKernel({db, agentHome} as any, continuity);

    // Genesis record has sessionCount=0, advance to 1
    kernel.startSession('sess-1');

    const selfBefore = continuity.getCurrentState()!;
    expect(selfBefore.chainLength).toBe(1); // genesis only

    const advanced = kernel.checkpointTurn();
    expect(advanced).toBe(true);

    const selfAfter = continuity.getCurrentState()!;
    expect(selfAfter.chainLength).toBe(2); // genesis + session advance
    expect(selfAfter.latestRecord.lastSessionId).toBe('sess-1');
    expect(selfAfter.latestRecord.sessionCount).toBe(1);
  });

  it('skips advance when no state change (session count matches)', () => {
    const { db, agentHome } = freshDb();
    const continuity = new ContinuityService(db, silentLogger, agentHome);
    continuity.hydrate({ soulContent: SOUL_CONTENT, soulName: 'WiringTestAgent' });

    const kernel = wireKernel({db, agentHome} as any, continuity);

    // Don't start any sessions — genesis record has sessionCount=0
    // and kernel._sessionCount is also 0
    const advanced = kernel.checkpointTurn();
    expect(advanced).toBe(false);

    // Chain should remain at genesis
    expect(continuity.getCurrentState()!.chainLength).toBe(1);
  });

  it('returns false when services not initialized', () => {
    const kernel = new Kernel();
    // No boot, no services
    const result = kernel.checkpointTurn();
    expect(result).toBe(false);
  });

  it('returns false when continuity not hydrated', () => {
    const { db, agentHome } = freshDb();
    const continuity = new ContinuityService(db, silentLogger, agentHome);
    // NOT hydrated — no call to hydrate()

    const kernel = wireKernel({db, agentHome} as any, continuity);
    const result = kernel.checkpointTurn();
    expect(result).toBe(false);
  });

  it('uses explicit sessionId when provided', () => {
    const { db, agentHome } = freshDb();
    const continuity = new ContinuityService(db, silentLogger, agentHome);
    continuity.hydrate({ soulContent: SOUL_CONTENT, soulName: 'WiringTestAgent' });

    const kernel = wireKernel({db, agentHome} as any, continuity);
    kernel.startSession('implied-session');

    const advanced = kernel.checkpointTurn('explicit-override');
    expect(advanced).toBe(true);

    const selfAfter = continuity.getCurrentState()!;
    expect(selfAfter.latestRecord.lastSessionId).toBe('explicit-override');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3. shutdown() — checkpointTurn wiring
// ══════════════════════════════════════════════════════════════════════
describe('Kernel.shutdown() — continuity wiring', () => {
  it('calls checkpointTurn during shutdown', async () => {
    const { db, agentHome } = freshDb();
    const continuity = new ContinuityService(db, silentLogger, agentHome);
    continuity.hydrate({ soulContent: SOUL_CONTENT, soulName: 'WiringTestAgent' });

    const kernel = wireKernel({db, agentHome} as any, continuity);
    kernel.startSession('shutdown-session');

    // Spy on checkpointTurn to verify it's called
    const checkpointSpy = vi.spyOn(kernel, 'checkpointTurn');

    await kernel.shutdown();

    expect(checkpointSpy).toHaveBeenCalledTimes(1);
    checkpointSpy.mockRestore();
  });

  it('continuity is advanced before services are nulled', async () => {
    const { db, agentHome } = freshDb();
    const continuity = new ContinuityService(db, silentLogger, agentHome);
    continuity.hydrate({ soulContent: SOUL_CONTENT, soulName: 'WiringTestAgent' });

    const kernel = wireKernel({db, agentHome} as any, continuity);
    kernel.startSession('pre-shutdown-session');

    expect(continuity.getCurrentState()!.chainLength).toBe(1); // genesis

    await kernel.shutdown();

    // Continuity should have been advanced BEFORE services were nulled
    // We can verify by checking the DB directly (services are null now)
    const verifyService = new ContinuityService(db, silentLogger, agentHome);
    const restoredState = verifyService.hydrate({ soulContent: SOUL_CONTENT, soulName: 'WiringTestAgent' });

    expect(restoredState.chainLength).toBe(2); // genesis + session advance
    expect(restoredState.latestRecord.sessionCount).toBe(1);
    expect(restoredState.latestRecord.lastSessionId).toBe('pre-shutdown-session');
  });

  it('running flag is false after shutdown', async () => {
    const { db, agentHome } = freshDb();
    const continuity = new ContinuityService(db, silentLogger, agentHome);
    continuity.hydrate({ soulContent: SOUL_CONTENT, soulName: 'WiringTestAgent' });

    const kernel = wireKernel({db, agentHome} as any, continuity);
    expect(kernel.running).toBe(true);

    await kernel.shutdown();
    expect(kernel.running).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4. Multiple session lifecycle — full sequence
// ══════════════════════════════════════════════════════════════════════
describe('Kernel — multi-session lifecycle', () => {
  it('tracks continuity across multiple start + checkpoint cycles', () => {
    const { db, agentHome } = freshDb();
    const continuity = new ContinuityService(db, silentLogger, agentHome);
    continuity.hydrate({ soulContent: SOUL_CONTENT, soulName: 'WiringTestAgent' });

    const kernel = wireKernel({db, agentHome} as any, continuity);

    // Session 1
    kernel.startSession('sess-1');
    const advanced1 = kernel.checkpointTurn();
    expect(advanced1).toBe(true);

    // Session 2
    kernel.startSession('sess-2');
    const advanced2 = kernel.checkpointTurn();
    expect(advanced2).toBe(true);

    // Session 3
    kernel.startSession('sess-3');
    const advanced3 = kernel.checkpointTurn();
    expect(advanced3).toBe(true);

    // Final state
    const state = continuity.getCurrentState()!;
    expect(state.chainLength).toBe(4); // genesis + 3 sessions
    expect(state.latestRecord.sessionCount).toBe(3);
    expect(state.latestRecord.lastSessionId).toBe('sess-3');
    expect(state.chainValid).toBe(true);
    expect(state.soulDrifted).toBe(false);
  });

  it('second checkpoint without new session is a no-op', () => {
    const { db, agentHome } = freshDb();
    const continuity = new ContinuityService(db, silentLogger, agentHome);
    continuity.hydrate({ soulContent: SOUL_CONTENT, soulName: 'WiringTestAgent' });

    const kernel = wireKernel({db, agentHome} as any, continuity);

    kernel.startSession('only-session');
    const advanced1 = kernel.checkpointTurn();
    expect(advanced1).toBe(true);

    // Second checkpoint without new startSession — no-op
    const advanced2 = kernel.checkpointTurn();
    expect(advanced2).toBe(false);

    expect(continuity.getCurrentState()!.chainLength).toBe(2); // only 1 advance
  });
});
