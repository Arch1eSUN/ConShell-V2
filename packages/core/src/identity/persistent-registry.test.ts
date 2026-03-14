/**
 * PersistentAgentRegistry — integration tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase } from '../state/database.js';
import { PersistentAgentRegistry } from './persistent-registry.js';
import { createAgentCard, type AgentCard } from './index.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const noop = () => {};
const silentLogger = {
  info: noop, debug: noop, warn: noop, error: noop,
  child: () => silentLogger,
} as any;

function makeCard(overrides: Partial<AgentCard> = {}): AgentCard {
  return {
    ...createAgentCard({
      name: 'test-agent',
      version: '1.0.0',
      services: [{ type: 'chat', endpoint: 'http://localhost:3000/chat' }],
    }),
    ...overrides,
  };
}

describe('PersistentAgentRegistry (P2-1)', () => {
  let db: ReturnType<typeof openDatabase>;
  let registry: PersistentAgentRegistry;

  beforeEach(() => {
    const agentHome = join(tmpdir(), `conshell-test-${randomUUID()}`);
    mkdirSync(agentHome, { recursive: true });
    db = openDatabase({ agentHome, logger: silentLogger });
    registry = new PersistentAgentRegistry(db);
  });

  it('registers and looks up a card', async () => {
    const card = makeCard();
    await registry.register(card);

    const found = await registry.lookup('test-agent');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('test-agent');
    expect(found!.version).toBe('1.0.0');
    expect(found!.services).toHaveLength(1);
    expect(found!.services[0]!.type).toBe('chat');
  });

  it('lookup is case-insensitive', async () => {
    const card = makeCard({ name: 'MyAgent' });
    await registry.register(card);

    const found = await registry.lookup('myagent');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('MyAgent');
  });

  it('returns null for unknown agents', async () => {
    const found = await registry.lookup('nonexistent');
    expect(found).toBeNull();
  });

  it('listAll returns all registered cards', async () => {
    await registry.register(makeCard({ name: 'agent-alpha' }));
    await registry.register(makeCard({ name: 'agent-beta' }));

    const all = await registry.listAll();
    expect(all).toHaveLength(2);
    expect(all.map(c => c.name)).toContain('agent-alpha');
    expect(all.map(c => c.name)).toContain('agent-beta');
  });

  it('searchByService filters by service type', async () => {
    await registry.register(makeCard({
      name: 'chat-agent',
      services: [{ type: 'chat', endpoint: 'http://a/chat' }],
    }));
    await registry.register(makeCard({
      name: 'code-agent',
      services: [{ type: 'code', endpoint: 'http://b/code' }],
    }));

    const chatAgents = await registry.searchByService('chat');
    expect(chatAgents).toHaveLength(1);
    expect(chatAgents[0]!.name).toBe('chat-agent');

    const noMatch = await registry.searchByService('dance');
    expect(noMatch).toHaveLength(0);
  });

  it('re-register (upsert) updates existing card', async () => {
    const card = makeCard({ name: 'updatable' });
    await registry.register(card);

    const updated = makeCard({
      name: 'updatable',
      version: '2.0.0',
      services: [
        { type: 'chat', endpoint: 'http://a/chat' },
        { type: 'code', endpoint: 'http://a/code' },
      ],
    });
    await registry.register(updated);

    const found = await registry.lookup('updatable');
    expect(found!.version).toBe('2.0.0');
    expect(found!.services).toHaveLength(2);

    // Still only one entry, not duplicated
    const all = await registry.listAll();
    expect(all).toHaveLength(1);
  });

  it('survives database reopen (persistence)', () => {
    // Since openTestDatabase uses :memory:, we simulate by using the same db
    // but creating a NEW registry instance — proving the class reads from DB
    const card = makeCard({ name: 'persistent-self' });
    const reg1 = new PersistentAgentRegistry(db);
    // Sync register
    reg1.register(card);

    // New instance, same DB
    const reg2 = new PersistentAgentRegistry(db);
    return reg2.lookup('persistent-self').then(found => {
      expect(found).not.toBeNull();
      expect(found!.name).toBe('persistent-self');
    });
  });

  it('rejects invalid cards', async () => {
    const bad = makeCard({ name: 'x', nonce: '123' }); // name too short (1 char), nonce too short
    await expect(registry.register(bad)).rejects.toThrow('Invalid agent card');
  });

  // ── Goal E (Round 15.0.2): Identity contract edge cases ───────────
  it('same name + different id → version/services updated, id preserved (UPSERT on name)', async () => {
    const cardV1 = makeCard({ id: 'id-v1', name: 'evolving-agent', version: '1.0.0' });
    const cardV2 = makeCard({ id: 'id-v2', name: 'evolving-agent', version: '2.0.0' });

    await registry.register(cardV1);
    let found = await registry.lookup('evolving-agent');
    expect(found!.id).toBe('id-v1');
    expect(found!.version).toBe('1.0.0');

    // Re-register same name with different id — version/services update, id stays (PK not overwritten)
    await registry.register(cardV2);
    found = await registry.lookup('evolving-agent');
    expect(found!.id).toBe('id-v1'); // PK preserved by UPSERT
    expect(found!.version).toBe('2.0.0'); // version updated

    // Only one entry in registry
    const all = await registry.listAll();
    expect(all).toHaveLength(1);
  });

  it('different name + same id → UNIQUE constraint prevents duplicate (id is PK)', async () => {
    const sharedId = 'shared-uuid-123';
    const cardA = makeCard({ id: sharedId, name: 'agent-alpha', version: '1.0.0' });
    const cardB = makeCard({ id: sharedId, name: 'agent-beta', version: '1.0.0' });

    await registry.register(cardA);

    // Second register with same id but different name should fail
    // because id is PRIMARY KEY (unique constraint)
    await expect(registry.register(cardB)).rejects.toThrow('UNIQUE constraint');

    // Only one entry exists
    const all = await registry.listAll();
    expect(all).toHaveLength(1);
  });
});
