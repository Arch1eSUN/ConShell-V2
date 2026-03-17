/**
 * Soul Module — 导出
 */
export { SoulSystem } from './system.js';
export type { SoulData, SoulSystemOptions } from './system.js';

// ── Narrative Governance (Round 15.6 — Goal E) ──────────────────────
export { evaluateNarrativeUpdate, isAuthorizedTrigger } from './narrative-governance.js';
export type {
  NarrativeTrigger, NarrativeUpdateRequest,
  NarrativeDecision, RejectedFact,
} from './narrative-governance.js';
