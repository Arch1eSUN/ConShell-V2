/**
 * Memory Ownership — Round 15.6 (Goal C)
 *
 * Defines memory classification and ownership for identity-aware memory:
 *   - MemoryClass: self/user/environment/session/lineage
 *   - MemoryOwnership: binds class + identityId + retention policy
 *   - classifyMemory(): rule-based classification
 *   - RetentionPolicy: per-class decay rules
 *
 * This module closes the gap between "who am I" (identity) and
 * "what have I experienced" (memory) by ensuring every memory
 * entry knows which identity it belongs to and how it should be retained.
 */

// ── Types ─────────────────────────────────────────────────────────────

/**
 * Memory classification — categorizes what a memory is about.
 *
 * SELF: defines who I am (skills learned, decisions made, self-reflections)
 * USER: about users/operators (preferences, interaction history)
 * ENVIRONMENT: about external world (facts, environment state)
 * SESSION: session-only transient data, not promoted to long-term
 * LINEAGE: shareable with child agents
 */
export enum MemoryClass {
  SELF = 'self',
  USER = 'user',
  ENVIRONMENT = 'environment',
  SESSION = 'session',
  LINEAGE = 'lineage',
}

/**
 * Full memory ownership descriptor.
 * Applied to every memory entry at write time.
 */
export interface MemoryOwnership {
  /** Classification of this memory */
  class: MemoryClass;
  /** FK to the identity that owns this memory */
  identityId: string;
  /** Whether child agents can inherit this memory */
  inheritable: boolean;
  /** Whether this memory contributes to self-continuity */
  selfDefining: boolean;
}

/**
 * Retention duration per memory class.
 * Returned by getRetentionPolicy().
 */
export interface RetentionRule {
  class: MemoryClass;
  /** 'permanent' | duration string like '30d', '7d', 'ephemeral' */
  retention: string;
  /** Whether this class gets decay-protection */
  protectedFromDecay: boolean;
}

// ── Retention Policy ────────────────────────────────────────────────────

/** Default retention rules per memory class */
export const DEFAULT_RETENTION_POLICIES: readonly RetentionRule[] = Object.freeze([
  { class: MemoryClass.SELF, retention: 'permanent', protectedFromDecay: true },
  { class: MemoryClass.USER, retention: '30d', protectedFromDecay: false },
  { class: MemoryClass.ENVIRONMENT, retention: '7d', protectedFromDecay: false },
  { class: MemoryClass.SESSION, retention: 'ephemeral', protectedFromDecay: false },
  { class: MemoryClass.LINEAGE, retention: 'permanent', protectedFromDecay: true },
]);

/**
 * Get the retention rule for a given memory class.
 */
export function getRetentionPolicy(cls: MemoryClass): RetentionRule {
  return DEFAULT_RETENTION_POLICIES.find(r => r.class === cls) ?? {
    class: cls,
    retention: 'ephemeral',
    protectedFromDecay: false,
  };
}

// ── Classification Rules ────────────────────────────────────────────────

/**
 * Self-defining event types — these memories constitute "who I am".
 */
const SELF_DEFINING_PATTERNS: RegExp[] = [
  /^soul_/i,
  /^evolution_/i,
  /^identity_/i,
  /^capability_/i,
  /^skill_/i,
  /^decision_/i,
  /^self_reflection/i,
  /^learning_/i,
  /^continuity_/i,
];

/**
 * User-related event types — these memories are about operators/users.
 */
const USER_PATTERNS: RegExp[] = [
  /^user_/i,
  /^operator_/i,
  /^feedback_/i,
  /^preference_/i,
  /^interaction_/i,
  /^relationship_/i,
];

/**
 * Environment-related event types — external world state.
 */
const ENVIRONMENT_PATTERNS: RegExp[] = [
  /^env_/i,
  /^external_/i,
  /^market_/i,
  /^network_/i,
  /^system_/i,
  /^config_/i,
];

/**
 * Session-only event types — transient, not promoted.
 */
const SESSION_PATTERNS: RegExp[] = [
  /^session_/i,
  /^temp_/i,
  /^debug_/i,
  /^working_/i,
];

/**
 * Classify a memory entry based on its event type and content.
 * Priority order: SELF > USER > ENVIRONMENT > SESSION > default=ENVIRONMENT
 *
 * @param eventType - The event type string from the memory entry
 * @param content - The memory content (used for hints if eventType is ambiguous)
 * @returns The appropriate MemoryClass
 */
export function classifyMemory(eventType: string, content: string): MemoryClass {
  // Check self-defining first (highest priority)
  for (const pattern of SELF_DEFINING_PATTERNS) {
    if (pattern.test(eventType)) return MemoryClass.SELF;
  }

  // Check session-only (quick exit for known transients)
  for (const pattern of SESSION_PATTERNS) {
    if (pattern.test(eventType)) return MemoryClass.SESSION;
  }

  // Check user-related
  for (const pattern of USER_PATTERNS) {
    if (pattern.test(eventType)) return MemoryClass.USER;
  }

  // Check environment
  for (const pattern of ENVIRONMENT_PATTERNS) {
    if (pattern.test(eventType)) return MemoryClass.ENVIRONMENT;
  }

  // Content-based hints for consolidated turns
  if (eventType.startsWith('consolidated_')) {
    // Consolidated turns: check content for self-defining signals
    if (/\b(learned|evolved|decided|discovered|grew|realized)\b/i.test(content)) {
      return MemoryClass.SELF;
    }
    if (/\b(user|operator|they|asked|requested)\b/i.test(content)) {
      return MemoryClass.USER;
    }
    // Default consolidated turns → ENVIRONMENT
    return MemoryClass.ENVIRONMENT;
  }

  // Default: ENVIRONMENT (safe fallback — doesn't pollute self or user)
  return MemoryClass.ENVIRONMENT;
}

/**
 * Determine if a memory is self-defining based on its class and content.
 */
export function isSelfDefining(cls: MemoryClass): boolean {
  return cls === MemoryClass.SELF || cls === MemoryClass.LINEAGE;
}

/**
 * Determine if a memory is inheritable based on its class.
 */
export function isInheritable(cls: MemoryClass): boolean {
  return cls === MemoryClass.LINEAGE || cls === MemoryClass.SELF;
}

/**
 * Build a complete MemoryOwnership from classification.
 */
export function buildOwnership(
  eventType: string,
  content: string,
  identityId: string,
): MemoryOwnership {
  const cls = classifyMemory(eventType, content);
  return {
    class: cls,
    identityId,
    inheritable: isInheritable(cls),
    selfDefining: isSelfDefining(cls),
  };
}

// ── Identity-Memory Policy (Round 17.4) ──────────────────────────────

/**
 * Policy governing memory continuity during identity lifecycle events.
 */
export interface IdentityMemoryPolicy {
  /** Whether SELF memories carry over during identity rotation */
  carryOverSelfOnRotation: boolean;
  /** Whether LINEAGE memories carry over during identity rotation */
  carryOverLineageOnRotation: boolean;
  /** Whether to reclassify memories when identity is revoked */
  reclassifyOnRevocation: boolean;
  /** Max epochs of memory visible to current identity (0 = current only) */
  visibleEpochs: number;
}

/** Default identity-memory policy */
export const DEFAULT_IDENTITY_MEMORY_POLICY: IdentityMemoryPolicy = {
  carryOverSelfOnRotation: true,
  carryOverLineageOnRotation: true,
  reclassifyOnRevocation: false,
  visibleEpochs: 0, // Current epoch only
};

/**
 * Resolve memory ownership after identity rotation.
 * SELF and LINEAGE memories are carried over to the new identity
 * if policy permits; other memories remain with original owner.
 */
export function resolveOwnershipAfterRotation(
  ownership: MemoryOwnership,
  newIdentityId: string,
  policy: IdentityMemoryPolicy = DEFAULT_IDENTITY_MEMORY_POLICY,
): MemoryOwnership {
  // SELF memories carry over
  if (ownership.class === MemoryClass.SELF && policy.carryOverSelfOnRotation) {
    return { ...ownership, identityId: newIdentityId };
  }
  // LINEAGE memories carry over
  if (ownership.class === MemoryClass.LINEAGE && policy.carryOverLineageOnRotation) {
    return { ...ownership, identityId: newIdentityId };
  }
  // All other memories remain with original owner
  return ownership;
}

/**
 * Filter memories by identity epoch(s).
 * If visibleEpochs = 0, only memories belonging to currentIdentityId.
 * If visibleEpochs > 0, memories belonging to ancestors up to N epochs back.
 */
export function filterByIdentityEpoch(
  memories: readonly MemoryOwnership[],
  currentIdentityId: string,
  ancestorIdentityIds: readonly string[] = [],
  visibleEpochs: number = 0,
): readonly MemoryOwnership[] {
  const allowedIds = new Set<string>([currentIdentityId]);
  // Include ancestors up to visibleEpochs
  for (let i = 0; i < Math.min(visibleEpochs, ancestorIdentityIds.length); i++) {
    allowedIds.add(ancestorIdentityIds[i]!);
  }
  return memories.filter(m => allowedIds.has(m.identityId));
}

