/**
 * Memory Module — 导出
 */
export { MemoryTierManager } from './tier-manager.js';
export type { MemoryContext, TierManagerOptions } from './tier-manager.js';

// ── Memory Ownership (Round 15.6 — Goal C) ──────────────────────────
export {
  MemoryClass, classifyMemory, isSelfDefining, isInheritable,
  buildOwnership, getRetentionPolicy, DEFAULT_RETENTION_POLICIES,
} from './memory-ownership.js';
export type { MemoryOwnership, RetentionRule } from './memory-ownership.js';
