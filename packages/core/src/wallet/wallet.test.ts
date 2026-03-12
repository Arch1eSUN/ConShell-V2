/**
 * Phase 2D Tests — Wallet, ERC-8004, Identity, Facilitator, x402
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateWallet,
  encryptPrivateKey,
  decryptPrivateKey,
  createSiweMessage,
  signSiweMessage,
  verifySiweSignature,
  generateNonce,
  loadOrGenerateWallet,
  loadWallet,
} from './index.js';

// ── Wallet Generation ──────────────────────────────────────────────────

describe('Wallet Generation', () => {
  it('generates a wallet with required fields', () => {
    const w = generateWallet();
    expect(w.address).toMatch(/^0x[0-9a-f]{40}$/);
    expect(w.privateKey).toHaveLength(64);
    expect(w.publicKey).toHaveLength(64);
  });

  it('generates unique wallets each time', () => {
    const w1 = generateWallet();
    const w2 = generateWallet();
    expect(w1.address).not.toBe(w2.address);
    expect(w1.privateKey).not.toBe(w2.privateKey);
  });
});

// ── Encrypted Storage ──────────────────────────────────────────────────

describe('Encrypted Wallet Storage', () => {
  it('encrypts and decrypts a private key', () => {
    const wallet = generateWallet();
    const password = 'test-password-1234';

    const encrypted = encryptPrivateKey(wallet.privateKey, password);
    expect(encrypted.version).toBe(2);
    expect(encrypted.crypto.cipher).toBe('aes-256-gcm');
    expect(encrypted.crypto.kdf.algorithm).toBe('scrypt');

    const decrypted = decryptPrivateKey(encrypted, password);
    expect(decrypted).toBe(wallet.privateKey);
  });

  it('fails with wrong password', () => {
    const wallet = generateWallet();
    const encrypted = encryptPrivateKey(wallet.privateKey, 'correct');

    expect(() => decryptPrivateKey(encrypted, 'wrong')).toThrow();
  });

  it('generates unique IV and salt per encryption', () => {
    const wallet = generateWallet();
    const e1 = encryptPrivateKey(wallet.privateKey, 'pass');
    const e2 = encryptPrivateKey(wallet.privateKey, 'pass');
    expect(e1.crypto.iv).not.toBe(e2.crypto.iv);
    expect(e1.crypto.kdf.salt).not.toBe(e2.crypto.kdf.salt);
  });
});

// ── SIWE ───────────────────────────────────────────────────────────────

describe('SIWE (Sign-In with Ethereum)', () => {
  it('creates a valid SIWE message', () => {
    const msg = createSiweMessage({
      domain: 'conshell.ai',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      statement: 'Sign in to ConShell',
      uri: 'https://conshell.ai',
      version: '1',
      chainId: 8453,
      nonce: '1234567890abcdef',
      issuedAt: '2024-01-01T00:00:00Z',
    });

    expect(msg).toContain('conshell.ai');
    expect(msg).toContain('0x1234567890abcdef1234567890abcdef12345678');
    expect(msg).toContain('Chain ID: 8453');
    expect(msg).toContain('Sign in to ConShell');
  });

  it('signs a SIWE message', () => {
    const wallet = generateWallet();
    const msg = 'test message';
    const sig = signSiweMessage(msg, wallet.privateKey);
    expect(sig).toMatch(/^0x[0-9a-f]+$/);
  });

  it('generates unique nonces', () => {
    const n1 = generateNonce();
    const n2 = generateNonce();
    expect(n1).not.toBe(n2);
    expect(n1).toHaveLength(32);
  });
});

// ── File Operations ────────────────────────────────────────────────────

describe('Wallet File Operations', () => {
  it('returns null when loading from non-existent path', () => {
    const result = loadWallet('/tmp/nonexistent-wallet-dir-xyz');
    expect(result).toBeNull();
  });
});
