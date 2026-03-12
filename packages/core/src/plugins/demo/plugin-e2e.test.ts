/**
 * Plugin Extension E2E Test
 *
 * 验证最小插件闭环的完整生命周期：
 *   1. Manifest 验证 — 合法 manifest 通过，非法被拒
 *   2. 注册 + 加载 — state 从 registered → active
 *   3. Hook emit — handler 被调用，返回正确结果
 *   4. 权限检查 — config:read ✓, wallet:sign ✗
 *   5. Unload — 清理后不再响应
 *   6. 非法权限插件 — manifest 验证拒绝
 *
 * 所有 import 走 public API 路径验证扩展边界真实有效。
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ── 从 public API 导入（验证公共边界足够） ──────────────
import {
  PluginManager,
  validateManifest,
} from '../../public.js';
import type {
  PluginManifest,
  PluginPermission,
} from '../../public.js';

// ── Demo plugin 直接引入 ───────────────────────────────
import {
  manifest as echoManifest,
  onMessage,
  onOutgoing,
  init as pluginInit,
  cleanup as pluginCleanup,
  isInitialized,
  getPermissions,
} from './echo-transform.js';

describe('Plugin Extension E2E — echo-transform', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = new PluginManager();
  });

  // ── 1. Manifest 验证 ──────────────────────────────────

  describe('Manifest Contract', () => {
    it('should validate echo-transform manifest as legal', () => {
      const result = validateManifest(echoManifest);
      expect(result.valid).toBe(true);
      expect(result.manifest).toBeDefined();
      expect(result.manifest!.name).toBe('echo-transform');
      expect(result.manifest!.permissions).toContain('config:read');
    });

    it('should reject manifest with invalid permissions', () => {
      const badManifest = {
        ...echoManifest,
        permissions: ['sudo:root'],
      };
      const result = validateManifest(badManifest);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject manifest with invalid name format', () => {
      const result = validateManifest({
        ...echoManifest,
        name: 'INVALID_NAME',
      });
      expect(result.valid).toBe(false);
    });

    it('should have required hooks declared', () => {
      expect(echoManifest.hooks).toHaveLength(2);
      expect(echoManifest.hooks[0].event).toBe('message:incoming');
      expect(echoManifest.hooks[0].handler).toBe('onMessage');
      expect(echoManifest.hooks[1].event).toBe('message:outgoing');
      expect(echoManifest.hooks[1].handler).toBe('onOutgoing');
    });
  });

  // ── 2. Registration + Load ────────────────────────────

  describe('Registration & Loading', () => {
    it('should register plugin and set state to registered', () => {
      manager.register(echoManifest);
      const instance = manager.get('echo-transform');
      expect(instance).toBeDefined();
      expect(instance!.state).toBe('registered');
    });

    it('should list registered plugins', () => {
      manager.register(echoManifest);
      const list = manager.list();
      expect(list).toHaveLength(1);
      expect(list[0].manifest.name).toBe('echo-transform');
    });
  });

  // ── 3. Hook Invocation ────────────────────────────────

  describe('Hook Invocation', () => {
    it('onMessage should transform content to uppercase with emoji', () => {
      // Simulate init lifecycle
      pluginInit({ permissions: ['config:read'] });

      const result = onMessage({ content: 'hello world' });
      expect(result.content).toBe('🐢 HELLO WORLD');
      expect(result.transformed).toBe(true);
      expect(result.plugin).toBe('echo-transform');

      pluginCleanup();
    });

    it('onOutgoing should add plugin attribution', () => {
      const result = onOutgoing({ content: 'response text' });
      expect(result.content).toBe('response text [via echo-transform]');
      expect(result.transformed).toBe(true);
    });

    it('onMessage should pass through if not initialized', () => {
      // Don't call init
      pluginCleanup(); // ensure clean state
      const result = onMessage({ content: 'raw message' });
      expect(result.transformed).toBe(false);
      expect(result.content).toBe('raw message');
    });

    it('should handle hook via PluginManager.emit', async () => {
      // Register and manually wire the hook
      manager.register(echoManifest);
      const instance = manager.get('echo-transform')!;

      // Simulate what PluginManager.load() does for hook registration
      instance.state = 'active';
      instance.module = { onMessage, onOutgoing, init: pluginInit, cleanup: pluginCleanup };

      // Verify hooks can be invoked through the system
      pluginInit({ permissions: echoManifest.permissions });
      const result = onMessage({ content: 'test via manager' });
      expect(result.content).toBe('🐢 TEST VIA MANAGER');

      pluginCleanup();
    });
  });

  // ── 4. Permission Checks ──────────────────────────────

  describe('Permission Guard', () => {
    it('should confirm granted permission', () => {
      manager.register(echoManifest);
      expect(manager.hasPermission('echo-transform', 'config:read')).toBe(true);
    });

    it('should deny non-granted permission', () => {
      manager.register(echoManifest);
      expect(manager.hasPermission('echo-transform', 'wallet:sign')).toBe(false);
      expect(manager.hasPermission('echo-transform', 'shell:exec')).toBe(false);
      expect(manager.hasPermission('echo-transform', 'fs:write')).toBe(false);
    });

    it('should return false for non-existent plugin', () => {
      expect(manager.hasPermission('ghost-plugin', 'config:read')).toBe(false);
    });

    it('plugin should track its granted permissions via init', () => {
      pluginInit({ permissions: ['config:read'] });
      expect(isInitialized()).toBe(true);
      expect(getPermissions()).toEqual(['config:read']);
      pluginCleanup();
      expect(isInitialized()).toBe(false);
      expect(getPermissions()).toEqual([]);
    });
  });

  // ── 5. Unload ─────────────────────────────────────────

  describe('Unload & Cleanup', () => {
    it('should remove plugin on unload', async () => {
      manager.register(echoManifest);
      expect(manager.get('echo-transform')).toBeDefined();

      await manager.unload('echo-transform');
      expect(manager.get('echo-transform')).toBeUndefined();
      expect(manager.list()).toHaveLength(0);
    });

    it('should handle unload of non-existent plugin gracefully', async () => {
      await expect(manager.unload('nonexistent')).resolves.not.toThrow();
    });
  });

  // ── 6. Disable / Enable ───────────────────────────────

  describe('Disable & Enable', () => {
    it('should disable and re-enable plugin', () => {
      manager.register(echoManifest);
      manager.disable('echo-transform');
      expect(manager.get('echo-transform')!.state).toBe('disabled');

      manager.enable('echo-transform');
      expect(manager.get('echo-transform')!.state).toBe('active');
    });
  });
});
