/**
 * Plugins tests — PluginManager + manifest validation + hooks
 */
import { describe, it, expect, vi } from 'vitest';
import {
  validateManifest,
  PluginManager,
  pluginManifestSchema,
  type PluginManifest,
} from '../plugins/index.js';

describe('Plugins', () => {
  describe('validateManifest', () => {
    it('should validate a complete manifest', () => {
      const result = validateManifest({
        name: 'my-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        permissions: ['fs:read'],
        hooks: [{ event: 'message', handler: 'onMessage' }],
        entrypoint: 'index.js',
      });
      expect(result.valid).toBe(true);
      expect(result.manifest).toBeDefined();
    });

    it('should reject manifest without name', () => {
      const result = validateManifest({ version: '1.0.0', entrypoint: 'index.js' });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid version format', () => {
      const result = validateManifest({ name: 'test', version: 'bad', entrypoint: 'index.js' });
      expect(result.valid).toBe(false);
    });

    it('should reject invalid name format (uppercase)', () => {
      const result = validateManifest({ name: 'MyPlugin', version: '1.0.0', entrypoint: 'index.js' });
      expect(result.valid).toBe(false);
    });

    it('should accept valid permission values', () => {
      const result = validateManifest({
        name: 'test-plugin',
        version: '1.0.0',
        entrypoint: 'index.js',
        permissions: ['fs:read', 'fs:write', 'net:http', 'wallet:read'],
      });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid permission values', () => {
      const result = validateManifest({
        name: 'test-plugin',
        version: '1.0.0',
        entrypoint: 'index.js',
        permissions: ['sudo:root'],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('PluginManager', () => {
    const testManifest: PluginManifest = {
      name: 'test-plugin',
      version: '1.0.0',
      description: 'Test',
      license: 'MIT',
      permissions: ['fs:read'],
      hooks: [],
      entrypoint: 'index.js',
    };

    it('should register a plugin', () => {
      const mgr = new PluginManager();
      mgr.register(testManifest);
      expect(mgr.list()).toHaveLength(1);
      expect(mgr.get('test-plugin')?.state).toBe('registered');
    });

    it('should replace existing plugin on re-register', () => {
      const mgr = new PluginManager();
      mgr.register(testManifest);
      mgr.register({ ...testManifest, version: '2.0.0' });
      expect(mgr.list()).toHaveLength(1);
      expect(mgr.get('test-plugin')?.manifest.version).toBe('2.0.0');
    });

    it('should disable and enable a plugin', () => {
      const mgr = new PluginManager();
      mgr.register(testManifest);
      mgr.disable('test-plugin');
      expect(mgr.get('test-plugin')?.state).toBe('disabled');
      mgr.enable('test-plugin');
      expect(mgr.get('test-plugin')?.state).toBe('active'); // enable sets back to 'active'
    });

    it('should check permissions', () => {
      const mgr = new PluginManager();
      mgr.register(testManifest);
      expect(mgr.hasPermission('test-plugin', 'fs:read')).toBe(true);
      expect(mgr.hasPermission('test-plugin', 'wallet:sign')).toBe(false);
    });

    it('should unload and remove hooks', async () => {
      const mgr = new PluginManager();
      mgr.register(testManifest);
      await mgr.unload('test-plugin');
      expect(mgr.get('test-plugin')).toBeUndefined();
    });
  });

  describe('pluginManifestSchema', () => {
    it('should apply defaults', () => {
      const result = pluginManifestSchema.parse({
        name: 'minimal',
        version: '1.0.0',
        entrypoint: 'main.js',
      });
      expect(result.permissions).toEqual([]);
      expect(result.hooks).toEqual([]);
      expect(result.license).toBe('MIT');
      expect(result.description).toBe('');
    });
  });
});
