/**
 * Behavior Guidance — Lightweight Influence Layer (Round 15.2)
 *
 * Transforms retrieved memory + identity signals into structured behavior guidance.
 * This is the bridge between "memory is displayed" and "memory changes behavior."
 *
 * Input:  StructuredEpisode[] (from MemoryContext) + optional SelfState
 * Output: BehaviorGuidance → rendered as an independent prompt section
 */
import type { SelfState } from '../identity/continuity-service.js';

// ── Types ─────────────────────────────────────────────────────────────

/** Structured episode data — carried through MemoryContext from tier-manager */
export interface StructuredEpisode {
  eventType: string;
  content: string;
  importance: number;
  ownerId?: string;
}

/** The five influence types that memory can exert on behavior */
export type BehaviorInfluenceType =
  | 'stable_preference'
  | 'lesson'
  | 'warning'
  | 'continuity_priority'
  | 'transient_context';

/** How strongly this influence should affect behavior */
export type InfluenceStrength = 'high' | 'medium' | 'low';

/** Whether this influence persists across sessions */
export type InfluenceDurability = 'durable' | 'transient';

/** A single unit of behavior influence — explainable and auditable */
export interface BehaviorInfluence {
  type: BehaviorInfluenceType;
  strength: InfluenceStrength;
  durability: InfluenceDurability;
  guidanceText: string;
  /** Explainability: where this influence came from */
  source: string;
}

/** Structured behavior guidance output, grouped by influence type */
export interface BehaviorGuidance {
  stablePreferences: BehaviorInfluence[];
  lessonsAndWarnings: BehaviorInfluence[];
  continuityPriorities: BehaviorInfluence[];
  transientContext: BehaviorInfluence[];
}

// ── Recall Policy Constants ───────────────────────────────────────────

/** event_type prefixes that map to stable preferences */
const PREFERENCE_PREFIXES = ['preference_', 'config_'];
/** event_type prefixes that map to lessons */
const LESSON_PREFIXES = ['lesson_', 'error_'];
/** event_type prefixes that map to warnings */
const WARNING_PREFIXES = ['consolidated_tool'];

// ── Core Functions ────────────────────────────────────────────────────

/**
 * Map importance score (0-10) to influence strength.
 * This is the Recall Policy's strength rule.
 */
export function importanceToStrength(importance: number): InfluenceStrength {
  if (importance >= 7) return 'high';
  if (importance >= 5) return 'medium';
  return 'low';
}

/**
 * Classify an episode's event_type into a BehaviorInfluenceType.
 * This is the Recall Policy's type classification rule.
 */
export function classifyEventType(eventType: string): BehaviorInfluenceType {
  const et = eventType.toLowerCase();
  if (PREFERENCE_PREFIXES.some(p => et.startsWith(p))) return 'stable_preference';
  if (LESSON_PREFIXES.some(p => et.startsWith(p))) return 'lesson';
  if (WARNING_PREFIXES.some(p => et.startsWith(p))) return 'warning';
  return 'transient_context';
}

/**
 * Determine durability from influence type.
 * Preferences, lessons, and warnings are durable (persist across sessions).
 * Transient context applies only to the current round.
 */
function influenceDurability(type: BehaviorInfluenceType): InfluenceDurability {
  if (type === 'transient_context') return 'transient';
  return 'durable';
}

/**
 * Extract structured behavior guidance from memory episodes and identity state.
 *
 * This is the core Recall Policy implementation:
 * - Classifies each episode by event_type → influence type
 * - Assigns strength by importance
 * - Assigns durability by influence type
 * - Injects continuity signals from SelfState
 *
 * @param episodes - Structured episodes from MemoryContext
 * @param selfState - Optional SelfState from ContinuityService
 * @returns BehaviorGuidance — ready for rendering
 */
export function extractBehaviorGuidance(
  episodes: StructuredEpisode[],
  selfState?: SelfState | null,
): BehaviorGuidance {
  const guidance: BehaviorGuidance = {
    stablePreferences: [],
    lessonsAndWarnings: [],
    continuityPriorities: [],
    transientContext: [],
  };

  // ── Episode → BehaviorInfluence ──
  for (const ep of episodes) {
    const type = classifyEventType(ep.eventType);
    const influence: BehaviorInfluence = {
      type,
      strength: importanceToStrength(ep.importance),
      durability: influenceDurability(type),
      guidanceText: ep.content,
      source: ep.eventType,
    };

    switch (type) {
      case 'stable_preference':
        guidance.stablePreferences.push(influence);
        break;
      case 'lesson':
      case 'warning':
        guidance.lessonsAndWarnings.push(influence);
        break;
      case 'transient_context':
        guidance.transientContext.push(influence);
        break;
      // continuity_priority is injected from selfState, not from episodes
    }
  }

  // ── Continuity signals → continuity_priority influences ──
  if (selfState) {
    const continuityInfluences = extractContinuityInfluences(selfState);
    guidance.continuityPriorities.push(...continuityInfluences);
  }

  return guidance;
}

/**
 * Extract continuity-related influences from SelfState.
 */
function extractContinuityInfluences(selfState: SelfState): BehaviorInfluence[] {
  const influences: BehaviorInfluence[] = [];

  if (selfState.mode === 'restart' && selfState.chainValid) {
    influences.push({
      type: 'continuity_priority',
      strength: 'medium',
      durability: 'durable',
      guidanceText: `Returning self with verified continuity chain (length: ${selfState.chainLength}). Prior preferences and lessons are trustworthy.`,
      source: 'continuity:restart-chain-valid',
    });
  }

  if (selfState.mode === 'restart' && selfState.soulDrifted) {
    influences.push({
      type: 'continuity_priority',
      strength: 'high',
      durability: 'durable',
      guidanceText: 'Soul has evolved since last session — re-evaluate prior preferences against current identity.',
      source: 'continuity:soul-drifted',
    });
  }

  if (selfState.mode === 'degraded') {
    influences.push({
      type: 'continuity_priority',
      strength: 'high',
      durability: 'durable',
      guidanceText: 'Continuity chain is broken — treat prior guidance with elevated caution. Verify assumptions before acting on stored preferences.',
      source: 'continuity:degraded',
    });
  }

  if (selfState.mode === 'genesis') {
    influences.push({
      type: 'continuity_priority',
      strength: 'low',
      durability: 'transient',
      guidanceText: 'First boot — no prior experiences to draw from. Build new preferences and lessons from this session.',
      source: 'continuity:genesis',
    });
  }

  return influences;
}

// ── Rendering ─────────────────────────────────────────────────────────

/** Strength labels for prompt rendering */
const STRENGTH_LABELS: Record<InfluenceStrength, string> = {
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
};

/**
 * Render a BehaviorGuidance into a structured prompt section.
 * Each influence is labeled with strength and source for explainability.
 */
export function renderBehaviorGuidance(guidance: BehaviorGuidance): string {
  const parts: string[] = [];

  const hasContent =
    guidance.stablePreferences.length > 0 ||
    guidance.lessonsAndWarnings.length > 0 ||
    guidance.continuityPriorities.length > 0;

  if (!hasContent) return '';

  parts.push('## 🎯 Behavior Guidance');
  parts.push('');

  if (guidance.stablePreferences.length > 0) {
    parts.push('### Stable Preferences (durable)');
    for (const inf of guidance.stablePreferences) {
      parts.push(`- [${STRENGTH_LABELS[inf.strength]}] ${inf.guidanceText} (source: ${inf.source})`);
    }
    parts.push('');
  }

  if (guidance.lessonsAndWarnings.length > 0) {
    parts.push('### Lessons & Warnings (durable)');
    for (const inf of guidance.lessonsAndWarnings) {
      parts.push(`- [${STRENGTH_LABELS[inf.strength]}] ${inf.guidanceText} (source: ${inf.source})`);
    }
    parts.push('');
  }

  if (guidance.continuityPriorities.length > 0) {
    parts.push('### Continuity Context');
    for (const inf of guidance.continuityPriorities) {
      parts.push(`- ${inf.guidanceText}`);
    }
    parts.push('');
  }

  // Transient context is deliberately NOT rendered in the behavior guidance section.
  // It remains in the memory reference sections where it was already displayed.
  // This enforces the durable vs transient separation.

  return parts.join('\n');
}
