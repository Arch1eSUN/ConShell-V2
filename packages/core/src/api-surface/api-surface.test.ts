/**
 * API Surface Contract Test
 *
 * Verifies that @conshell/core/public exports exactly the symbols
 * that external consumers depend on. If this test breaks, it means
 * the public API surface changed — review carefully before fixing.
 */
import { describe, it, expect } from 'vitest';

// Import everything from public.ts
import * as PublicAPI from '../public.js';

describe('Public API Surface Contract', () => {
  // ── Value exports ─────────────────────────────────────────
  it('should export VERSION as a string', () => {
    expect(typeof PublicAPI.VERSION).toBe('string');
    expect(PublicAPI.VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('should export Kernel class', () => {
    expect(PublicAPI.Kernel).toBeDefined();
    expect(typeof PublicAPI.Kernel).toBe('function');
  });

  it('should export createKernel function', () => {
    expect(PublicAPI.createKernel).toBeDefined();
    expect(typeof PublicAPI.createKernel).toBe('function');
  });

  it('should export loadConfig function', () => {
    expect(PublicAPI.loadConfig).toBeDefined();
    expect(typeof PublicAPI.loadConfig).toBe('function');
  });

  it('should export createLogger function', () => {
    expect(PublicAPI.createLogger).toBeDefined();
    expect(typeof PublicAPI.createLogger).toBe('function');
  });

  it('should export toCents and ZERO_CENTS', () => {
    expect(PublicAPI.toCents).toBeDefined();
    expect(typeof PublicAPI.toCents).toBe('function');
    expect(PublicAPI.ZERO_CENTS).toBeDefined();
  });

  it('should export THREE_LAWS and CONSTITUTION_HASH', () => {
    expect(PublicAPI.THREE_LAWS).toBeDefined();
    expect(Array.isArray(PublicAPI.THREE_LAWS)).toBe(true);
    expect(PublicAPI.THREE_LAWS.length).toBe(3);
    expect(typeof PublicAPI.CONSTITUTION_HASH).toBe('string');
  });

  it('should export PluginManager class', () => {
    expect(PublicAPI.PluginManager).toBeDefined();
    expect(typeof PublicAPI.PluginManager).toBe('function');
  });

  it('should export validateManifest function', () => {
    expect(PublicAPI.validateManifest).toBeDefined();
    expect(typeof PublicAPI.validateManifest).toBe('function');
  });

  it('should export WebChatAdapter class', () => {
    expect(PublicAPI.WebChatAdapter).toBeDefined();
    expect(typeof PublicAPI.WebChatAdapter).toBe('function');
  });

  it('should export ChannelManager class', () => {
    expect(PublicAPI.ChannelManager).toBeDefined();
    expect(typeof PublicAPI.ChannelManager).toBe('function');
  });

  it('should export WebChatTransport class', () => {
    expect(PublicAPI.WebChatTransport).toBeDefined();
    expect(typeof PublicAPI.WebChatTransport).toBe('function');
  });

  it('should export validateRequest function', () => {
    expect(PublicAPI.validateRequest).toBeDefined();
    expect(typeof PublicAPI.validateRequest).toBe('function');
  });

  it('should export WebChatPushBridge class', () => {
    expect(PublicAPI.WebChatPushBridge).toBeDefined();
    expect(typeof PublicAPI.WebChatPushBridge).toBe('function');
  });

  // ── Exhaustive surface check ──────────────────────────────
  it('should export exactly the expected value symbols', () => {
    const exportedKeys = Object.keys(PublicAPI).sort();
    const expectedKeys = [
      'CONSTITUTION_HASH',
      'ChannelManager',
      'Kernel',
      'PluginManager',
      'THREE_LAWS',
      'VERSION',
      'WebChatAdapter',
      'WebChatPushBridge',
      'WebChatTransport',
      'ZERO_CENTS',
      'createKernel',
      'createLogger',
      'loadConfig',
      'toCents',
      'validateManifest',
      'validateRequest',
    ].sort();

    expect(exportedKeys).toEqual(expectedKeys);
  });
});
