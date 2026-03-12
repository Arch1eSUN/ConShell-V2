/**
 * Echo-Transform Demo Plugin
 *
 * 🐢 ConShellV2 最小真实插件样例
 *
 * 功能：
 *   - 接收消息，返回大写 + emoji 格式化
 *   - 演示完整的 manifest + lifecycle + hook 契约
 *   - 带最小权限声明（config:read）
 *
 * 这个插件证明：
 *   1. PluginManifest 定义足够
 *   2. PluginManager 可以 register → load → invoke → unload
 *   3. 权限检查真实生效
 *   4. Hook 系统可以传递数据
 */

import type { PluginManifest, PluginPermission } from '../../public.js';

// ── Manifest ────────────────────────────────────────────

export const manifest: PluginManifest = {
  name: 'echo-transform',
  version: '1.0.0',
  description: 'Echo + transform messages (demo plugin)',
  author: 'ConShellV2',
  license: 'MIT',
  permissions: ['config:read'] as PluginPermission[],
  hooks: [
    { event: 'message:incoming', handler: 'onMessage' },
    { event: 'message:outgoing', handler: 'onOutgoing' },
  ],
  entrypoint: 'echo-transform.js',
};

// ── Lifecycle ───────────────────────────────────────────

let initialized = false;
let grantedPermissions: string[] = [];

/**
 * Called by PluginManager when the plugin is loaded.
 * Receives the plugin's granted permissions.
 */
export function init(ctx: { permissions: string[] }): void {
  grantedPermissions = ctx.permissions;
  initialized = true;
}

/**
 * Called by PluginManager when the plugin is unloaded.
 */
export function cleanup(): void {
  initialized = false;
  grantedPermissions = [];
}

// ── Hook Handlers ───────────────────────────────────────

export interface TransformResult {
  content: string;
  transformed: boolean;
  plugin: string;
}

/**
 * Hook: message:incoming
 * Transforms incoming messages to uppercase with emoji prefix.
 */
export function onMessage(data: { content: string }): TransformResult {
  if (!initialized) {
    return { content: data.content, transformed: false, plugin: manifest.name };
  }

  return {
    content: `🐢 ${data.content.toUpperCase()}`,
    transformed: true,
    plugin: manifest.name,
  };
}

/**
 * Hook: message:outgoing
 * Adds plugin attribution to outgoing messages.
 */
export function onOutgoing(data: { content: string }): TransformResult {
  return {
    content: `${data.content} [via ${manifest.name}]`,
    transformed: true,
    plugin: manifest.name,
  };
}

// ── Introspection ───────────────────────────────────────

export function isInitialized(): boolean {
  return initialized;
}

export function getPermissions(): string[] {
  return [...grantedPermissions];
}
