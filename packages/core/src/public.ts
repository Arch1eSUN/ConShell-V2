/**
 * @conshell/core/public — 稳定公共 API
 *
 * 🐢 Sovereign AI Agent Runtime — Public Interface Layer
 *
 * This module exports ONLY the stable, public interfaces that CLI,
 * dashboard, plugins, and channel adapters should depend on.
 *
 * For internal implementation details, use '@conshell/core' (full export).
 * Internal exports may change without notice.
 *
 * Categories:
 *   1. Runtime Entry    — Kernel, VERSION, boot types
 *   2. Configuration    — loadConfig, createLogger
 *   3. Core Types       — AgentState, Message, Cents
 *   4. Extension Points — ChannelAdapter, PluginManifest, PolicyContext
 */

// ═══════════════════════════════════════════════════════════════════════
// 1. Runtime Entry — boot and operate the agent
// ═══════════════════════════════════════════════════════════════════════

export { VERSION } from './index.js';
export { Kernel, createKernel } from './kernel/index.js';
export type { BootStage, BootStageResult, BootResult, KernelServices } from './kernel/index.js';

// ═══════════════════════════════════════════════════════════════════════
// 2. Configuration & Infrastructure
// ═══════════════════════════════════════════════════════════════════════

export type { AppConfig, InferenceMode, InterfaceMode } from './types/config.js';
export { loadConfig } from './config/index.js';
export { createLogger } from './logger/index.js';

// ═══════════════════════════════════════════════════════════════════════
// 3. Core Types — shared across all consumers
// ═══════════════════════════════════════════════════════════════════════

export type {
  AgentState,
  SecurityLevel,
  Cents,
  Message,
  ToolCallRequest,
  ToolResult,
} from './types/index.js';

export { toCents, ZERO_CENTS } from './types/index.js';

// ═══════════════════════════════════════════════════════════════════════
// 4. Extension Points — for plugin/channel developers
// ═══════════════════════════════════════════════════════════════════════

// Channel adapter contract
export type {
  ChannelAdapter,
  ChannelConfig,
  ChannelMessage,
  ChannelPlatform,
  ChannelState,
  OutboundMessage,
} from './channels/index.js';

// Plugin contract
export type {
  PluginManifest,
  PluginPermission,
  PluginHook,
  PluginState,
} from './plugins/index.js';

// Policy types (for plugins that need to interact with policy)
export type { PolicyContext, PolicyResult } from './policy/index.js';

// Constitution (immutable reference)
export { THREE_LAWS, CONSTITUTION_HASH } from './constitution/index.js';
export type { ConstitutionLaw } from './constitution/index.js';
