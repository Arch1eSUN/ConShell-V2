/**
 * Phase 2D Tests — Identity Module
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAgentCard,
  signAgentCard,
  validateAgentCard,
  cardFingerprint,
  InMemoryAgentRegistry,
  createSiweAuth,
} from './index.js';
import { generateWallet } from '../wallet/index.js';

// ── Agent Card ─────────────────────────────────────────────────────────

describe('Agent Card', () => {
  it('creates a card with required fields', () => {
    const card = createAgentCard({ name: 'TestAgent' });
    expect(card.name).toBe('TestAgent');
    expect(card.id).toBeTruthy();
    expect(card.nonce).toHaveLength(32);
    expect(card.version).toBe('1.0.0');
    expect(card.services).toEqual([]);
  });

  it('creates a card with services', () => {
    const card = createAgentCard({
      name: 'ServiceAgent',
      services: [
        { type: 'inference', endpoint: 'http://localhost:3000/inference' },
      ],
    });
    expect(card.services).toHaveLength(1);
    expect(card.services[0].type).toBe('inference');
  });

  it('signs a card with SIWE', () => {
    const wallet = generateWallet();
    const card = createAgentCard({
      name: 'SignedAgent',
      walletAddress: wallet.address,
    });

    const signed = signAgentCard(card, wallet.privateKey, 'conshell.ai');
    expect(signed.signature).toMatch(/^0x/);
  });

  it('throws when signing without wallet address', () => {
    const card = createAgentCard({ name: 'NoWallet' });
    expect(() => signAgentCard(card, 'abc', 'test.com')).toThrow('wallet address');
  });
});

// ── Validation ─────────────────────────────────────────────────────────

describe('Agent Card Validation', () => {
  it('validates a correct card', () => {
    const card = createAgentCard({ name: 'ValidAgent' });
    const result = validateAgentCard(card);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects card with short name', () => {
    const card = createAgentCard({ name: 'A' });
    const result = validateAgentCard(card);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Name');
  });

  it('rejects card with invalid service', () => {
    const card = createAgentCard({
      name: 'BadService',
      services: [{ type: '', endpoint: '' }],
    });
    const result = validateAgentCard(card);
    expect(result.valid).toBe(false);
  });
});

// ── Fingerprint ────────────────────────────────────────────────────────

describe('Card Fingerprint', () => {
  it('generates consistent fingerprints', () => {
    const card = createAgentCard({ name: 'FP-Test' });
    const fp1 = cardFingerprint(card);
    const fp2 = cardFingerprint(card);
    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(16);
  });

  it('generates different fingerprints for different cards', () => {
    const c1 = createAgentCard({ name: 'Agent1' });
    const c2 = createAgentCard({ name: 'Agent2' });
    expect(cardFingerprint(c1)).not.toBe(cardFingerprint(c2));
  });
});

// ── Registry ───────────────────────────────────────────────────────────

describe('InMemoryAgentRegistry', () => {
  let registry: InMemoryAgentRegistry;

  beforeEach(() => {
    registry = new InMemoryAgentRegistry();
  });

  it('registers and looks up an agent', async () => {
    const card = createAgentCard({ name: 'RegAgent' });
    await registry.register(card);

    const found = await registry.lookup('RegAgent');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('RegAgent');
  });

  it('lookup is case-insensitive', async () => {
    const card = createAgentCard({ name: 'CaseTest' });
    await registry.register(card);

    expect(await registry.lookup('casetest')).not.toBeNull();
    expect(await registry.lookup('CASETEST')).not.toBeNull();
  });

  it('returns null for unknown agent', async () => {
    expect(await registry.lookup('nobody')).toBeNull();
  });

  it('searches by service type', async () => {
    const card = createAgentCard({
      name: 'InferenceAgent',
      services: [{ type: 'inference', endpoint: 'http://localhost:3000' }],
    });
    await registry.register(card);

    const results = await registry.searchByService('inference');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('InferenceAgent');
  });

  it('lists all agents', async () => {
    await registry.register(createAgentCard({ name: 'A1' }));
    await registry.register(createAgentCard({ name: 'A2' }));

    const all = await registry.listAll();
    expect(all).toHaveLength(2);
  });

  it('rejects invalid card', async () => {
    const card = createAgentCard({ name: 'X' });
    await expect(registry.register(card)).rejects.toThrow('Invalid');
  });
});

// ── SIWE Auth ──────────────────────────────────────────────────────────

describe('SIWE Authentication', () => {
  it('creates a SIWE auth pair', () => {
    const wallet = generateWallet();
    const auth = createSiweAuth({
      domain: 'conshell.ai',
      address: wallet.address,
      privateKey: wallet.privateKey,
    });
    expect(auth.message).toContain('conshell.ai');
    expect(auth.signature).toMatch(/^0x/);
  });
});
