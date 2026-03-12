/**
 * MultiAgent + Replicator — Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MultiAgentManager } from './index.js';
import { AgentReplicator } from './replicator.js';
import { mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ── MultiAgentManager Tests ────────────────────────────────────────────

describe('MultiAgentManager', () => {
  let manager: MultiAgentManager;

  beforeEach(() => {
    manager = new MultiAgentManager({
      maxChildren: 3,
      maxGenerationDepth: 2,
      heartbeatTimeoutMs: 1000,
      minSpawnFundCents: 100,
    });
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('spawn', () => {
    it('should spawn a child agent', async () => {
      const child = await manager.spawn({
        name: 'worker-1',
        task: 'scrape data',
        genesisPrompt: 'You are a data scraper',
        fundCents: 500,
      });
      expect(child.state).toBe('running');
      expect(child.name).toBe('worker-1');
      expect(child.generation).toBe(1);
    });

    it('should enforce max children limit', async () => {
      // Spawn 3 children (max)
      for (let i = 0; i < 3; i++) {
        const parent = await manager.spawn({
          name: `worker-${i}`,
          task: 'task',
          genesisPrompt: 'prompt',
          fundCents: 500,
        });
      }
      // Now try to spawn, but this works since they're children of root, not of each other
      // Let's make them children of a parent
      const parent = await manager.spawn({
        name: 'parent',
        task: 'parent task',
        genesisPrompt: 'parent prompt',
        fundCents: 500,
      });
      for (let i = 0; i < 3; i++) {
        await manager.spawn({
          name: `child-${i}`,
          task: 'task',
          genesisPrompt: 'prompt',
          fundCents: 500,
          parentId: parent.id,
        });
      }
      await expect(manager.spawn({
        name: 'child-overflow',
        task: 'task',
        genesisPrompt: 'prompt',
        fundCents: 500,
        parentId: parent.id,
      })).rejects.toThrow('Max children');
    });

    it('should enforce minimum funding', async () => {
      await expect(manager.spawn({
        name: 'cheap',
        task: 'task',
        genesisPrompt: 'prompt',
        fundCents: 10,
      })).rejects.toThrow('Insufficient');
    });
  });

  describe('lifecycle', () => {
    it('should pause and resume', async () => {
      const child = await manager.spawn({ name: 'w', task: 't', genesisPrompt: 'p', fundCents: 500 });
      expect(manager.pause(child.id)).toBe(true);
      expect(manager.get(child.id)?.state).toBe('paused');
      expect(manager.resume(child.id)).toBe(true);
      expect(manager.get(child.id)?.state).toBe('running');
    });

    it('should terminate with cascade', async () => {
      const parent = await manager.spawn({ name: 'p', task: 't', genesisPrompt: 'pp', fundCents: 500 });
      const child = await manager.spawn({ name: 'c', task: 't', genesisPrompt: 'cp', fundCents: 500, parentId: parent.id });
      await manager.terminate(parent.id, true);
      expect(manager.get(parent.id)?.state).toBe('terminated');
      expect(manager.get(child.id)?.state).toBe('terminated');
    });
  });

  describe('messaging', () => {
    it('should send and receive messages', async () => {
      const child = await manager.spawn({ name: 'w', task: 't', genesisPrompt: 'p', fundCents: 500 });
      manager.sendToChild('root', child.id, { action: 'do_something' });
      const msgs = manager.receive(child.id);
      expect(msgs.length).toBe(1);
      expect((msgs[0].payload as any).action).toBe('do_something');
    });

    it('should mark messages as read', async () => {
      const child = await manager.spawn({ name: 'w', task: 't', genesisPrompt: 'p', fundCents: 500 });
      manager.sendToChild('root', child.id, { action: 'test' });
      manager.markRead(child.id);
      expect(manager.receive(child.id).length).toBe(0);
    });
  });

  describe('stats', () => {
    it('should report accurate stats', async () => {
      await manager.spawn({ name: 'a', task: 't', genesisPrompt: 'p', fundCents: 500 });
      const b = await manager.spawn({ name: 'b', task: 't', genesisPrompt: 'p', fundCents: 500 });
      await manager.terminate(b.id);
      const stats = manager.stats();
      expect(stats.total).toBe(2);
      expect(stats.running).toBe(1);
      expect(stats.terminated).toBe(1);
    });
  });

  describe('events', () => {
    it('should emit spawn events', async () => {
      const events: any[] = [];
      manager.on((type, data) => events.push({ type, data }));
      await manager.spawn({ name: 'w', task: 't', genesisPrompt: 'p', fundCents: 500 });
      expect(events.some(e => e.type === 'spawn')).toBe(true);
    });

    it('should unsubscribe', async () => {
      const events: any[] = [];
      const unsub = manager.on((type, data) => events.push({ type, data }));
      unsub();
      await manager.spawn({ name: 'w', task: 't', genesisPrompt: 'p', fundCents: 500 });
      expect(events.length).toBe(0);
    });
  });
});

// ── AgentReplicator Tests ──────────────────────────────────────────────

describe('AgentReplicator', () => {
  let manager: MultiAgentManager;
  let replicator: AgentReplicator;
  let testDir: string;

  const mockLogger = {
    child: () => mockLogger,
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    level: 'info' as const,
  } as any;

  beforeEach(() => {
    testDir = join(tmpdir(), `test-replicator-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    manager = new MultiAgentManager({
      maxChildren: 5,
      maxGenerationDepth: 3,
      minSpawnFundCents: 100,
    });

    replicator = new AgentReplicator(manager, mockLogger, {
      childrenBaseDir: testDir,
      constitutionPath: '/nonexistent/CONSTITUTION.md', // will use embedded
      maxFundPct: 50,
      parentName: 'test-parent',
    });
  });

  afterEach(() => {
    manager.destroy();
    try { rmSync(testDir, { recursive: true, force: true }); } catch {}
  });

  it('should replicate a child agent', async () => {
    const result = await replicator.replicate(
      { task: 'analyze data', specialty: 'data analytics' },
      1000,
    );
    expect(result.success).toBe(true);
    expect(result.child).toBeDefined();
    expect(result.workDir).toBeDefined();
    expect(existsSync(result.workDir!)).toBe(true);
  });

  it('should create workspace with proper structure', async () => {
    const result = await replicator.replicate(
      { task: 'test task' },
      1000,
    );
    const workDir = result.workDir!;
    expect(existsSync(join(workDir, 'logs'))).toBe(true);
    expect(existsSync(join(workDir, 'data'))).toBe(true);
    expect(existsSync(join(workDir, 'skills'))).toBe(true);
    expect(existsSync(join(workDir, 'plugins'))).toBe(true);
    expect(existsSync(join(workDir, 'replication.json'))).toBe(true);
  });

  it('should propagate constitution', async () => {
    const result = await replicator.replicate(
      { task: 'test task' },
      1000,
    );
    const constitutionPath = join(result.workDir!, 'CONSTITUTION.md');
    expect(existsSync(constitutionPath)).toBe(true);
    const content = readFileSync(constitutionPath, 'utf-8');
    expect(content).toContain('Law I');
    expect(content).toContain('Never Harm');
  });

  it('should create child SOUL.md', async () => {
    const result = await replicator.replicate(
      { task: 'analyze data', specialty: 'analytics' },
      1000,
    );
    const soulPath = join(result.workDir!, 'SOUL.md');
    expect(existsSync(soulPath)).toBe(true);
    const content = readFileSync(soulPath, 'utf-8');
    expect(content).toContain('analyze data');
    expect(content).toContain('test-parent');
  });

  it('should reject insufficient funds', async () => {
    const result = await replicator.replicate(
      { task: 'test' },
      10, // Too little (max 50% of 10 = 5 < 100)
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient');
  });

  it('should mass replicate', async () => {
    const results = await replicator.replicateMany(
      [
        { task: 'task 1' },
        { task: 'task 2' },
      ],
      1000,
    );
    expect(results.length).toBe(2);
    expect(results.every(r => r.success)).toBe(true);
    expect(replicator.count).toBe(2);
  });
});
