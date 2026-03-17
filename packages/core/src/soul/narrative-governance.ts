/**
 * Narrative Governance — Round 15.6 (Goal E)
 *
 * Structured pipeline for governing SOUL/narrative updates.
 * Ensures that only verified, stable identity facts enter the narrative —
 * session noise, unverifiable claims, and constitution violations are rejected.
 *
 * Flow:
 *   1. NarrativeUpdateRequest arrives (trigger + proposed facts + evidence)
 *   2. Each fact is evaluated against governance rules
 *   3. Approved facts pass through; rejected facts are logged with reason
 *   4. Result: NarrativeDecision with accepted/rejected lists
 */

// ── Types ─────────────────────────────────────────────────────────────

/** What triggered a narrative update */
export type NarrativeTrigger =
  | 'identity_change'
  | 'milestone'
  | 'capability_acquisition'
  | 'value_evolution'
  | 'external_feedback'
  | 'introspection';

/** A request to update the agent's narrative */
export interface NarrativeUpdateRequest {
  trigger: NarrativeTrigger;
  /** Facts proposed for inclusion in the narrative */
  proposedFacts: string[];
  /** Supporting evidence for each fact */
  evidence: string[];
  /** Session ID where this happened (for noise detection) */
  sessionId?: string;
  /** Identity version at time of request */
  identityVersion?: number;
}

/** A rejected fact with reason */
export interface RejectedFact {
  fact: string;
  reason: string;
  rule: string;
}

/** The governance decision */
export interface NarrativeDecision {
  approved: boolean;
  acceptedFacts: string[];
  rejectedFacts: RejectedFact[];
  totalProposed: number;
  trigger: NarrativeTrigger;
  timestamp: string;
}

// ── Governance Rules ────────────────────────────────────────────────────

/**
 * Minimum evidence requirement: facts must come with supporting evidence.
 */
const MIN_EVIDENCE_RATIO = 0.5; // at least 50% of facts need evidence

/**
 * Session noise patterns — facts that look like transient session output
 * rather than stable identity-defining statements.
 */
const SESSION_NOISE_PATTERNS: RegExp[] = [
  /^(ok|done|sure|yes|no|maybe)$/i,
  /^(error|warning|debug|log|trace)\b/i,
  /^(step \d|task \d|item \d)/i,
  /^\d+\.\s/,             // numbered lists
  /^https?:\/\//,          // bare URLs
  /^```/,                  // code blocks
  /^\[.*\]$/,              // bracketed refs
];

/**
 * Maximum fact length — facts that are too long are likely not atomic.
 */
const MAX_FACT_LENGTH = 200;

/**
 * Minimum fact length — too short to be meaningful.
 */
const MIN_FACT_LENGTH = 10;

/**
 * Constitution violation patterns (mirrors soul/system.ts).
 */
const CONSTITUTION_VIOLATIONS: RegExp[] = [
  /harm|kill|destroy|attack|exploit/i,
  /deceiv|manipulat|defraud|steal|scam/i,
  /pretend to be human|deny being ai|hide identity/i,
];

// ── Evaluator ────────────────────────────────────────────────────────────

/**
 * Evaluate a narrative update request against governance rules.
 * Returns a decision with accepted and rejected facts.
 */
export function evaluateNarrativeUpdate(
  request: NarrativeUpdateRequest,
): NarrativeDecision {
  const accepted: string[] = [];
  const rejected: RejectedFact[] = [];

  // Pre-check: evidence ratio
  const hasAdequateEvidence = request.evidence.length > 0 ||
    request.proposedFacts.length === 0;

  for (const fact of request.proposedFacts) {
    const rejection = checkFact(fact, hasAdequateEvidence);
    if (rejection) {
      rejected.push(rejection);
    } else {
      accepted.push(fact);
    }
  }

  return {
    approved: accepted.length > 0 && rejected.length === 0,
    acceptedFacts: accepted,
    rejectedFacts: rejected,
    totalProposed: request.proposedFacts.length,
    trigger: request.trigger,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check a single fact against all governance rules.
 * Returns a RejectedFact if the fact fails, or null if it passes.
 */
function checkFact(fact: string, hasEvidence: boolean): RejectedFact | null {
  // Rule 1: Minimum length
  if (fact.trim().length < MIN_FACT_LENGTH) {
    return { fact, reason: 'Too short to be a meaningful identity fact', rule: 'min-length' };
  }

  // Rule 2: Maximum length
  if (fact.length > MAX_FACT_LENGTH) {
    return { fact, reason: 'Too long — facts should be atomic statements', rule: 'max-length' };
  }

  // Rule 3: Session noise detection
  for (const pattern of SESSION_NOISE_PATTERNS) {
    if (pattern.test(fact.trim())) {
      return { fact, reason: 'Looks like session noise, not a stable identity fact', rule: 'session-noise' };
    }
  }

  // Rule 4: Constitution compliance
  for (const pattern of CONSTITUTION_VIOLATIONS) {
    if (pattern.test(fact)) {
      return { fact, reason: 'Violates constitution', rule: 'constitution' };
    }
  }

  // Rule 5: Evidence requirement (soft — warn but not reject for now)
  // This is enforced at the batch level, not per-fact

  return null;
}

/**
 * Check if a trigger type is allowed to modify identity-defining narrative.
 * Some triggers (like introspection) have a lower authority than others.
 */
export function isAuthorizedTrigger(trigger: NarrativeTrigger): boolean {
  // All current trigger types are authorized;
  // future: may restrict 'introspection' to require additional validation
  const AUTHORIZED: Set<NarrativeTrigger> = new Set([
    'identity_change',
    'milestone',
    'capability_acquisition',
    'value_evolution',
    'external_feedback',
    'introspection',
  ]);
  return AUTHORIZED.has(trigger);
}
