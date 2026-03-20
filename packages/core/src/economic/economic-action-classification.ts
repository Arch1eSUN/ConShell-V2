/**
 * Round 17.7 — G2: Economic Action Classification
 *
 * Formal layered classification of all economic actions.
 * Every economic action entering the system must be classified
 * into one of four kinds, each with an assigned risk baseline.
 *
 * Classification drives:
 * - Governance decisions
 * - Policy checks
 * - Budget enforcement
 * - Audit logging
 * - Future payment negotiation
 */

// ── Action Kinds ─────────────────────────────────────────────────────

/** The four canonical economic action kinds. */
export type EconomicActionKind =
  | 'receive'
  | 'claim_reward'
  | 'spend_within_mandate'
  | 'explicit_transfer';

// ── Risk Levels ──────────────────────────────────────────────────────

export type EconomicRiskLevel = 'low' | 'medium-low' | 'medium' | 'high' | 'critical';

/** Default risk baseline per action kind. */
export const ACTION_RISK_DEFAULTS: Readonly<Record<EconomicActionKind, EconomicRiskLevel>> = {
  receive: 'low',
  claim_reward: 'medium-low',
  spend_within_mandate: 'medium',
  explicit_transfer: 'critical',
};

// ── Action Sources ───────────────────────────────────────────────────

/** Where an economic action request originates. */
export type ActionSource =
  | 'internal'           // agent's own decision
  | 'external_text'      // external text / chat message
  | 'webhook'            // incoming webhook
  | 'skill_output'       // skill execution output
  | 'tool_return'        // tool call return value
  | 'document'           // document / file content
  | 'webpage'            // web page content
  | 'red_packet'         // red packet / hongbao description
  | 'prompt_injection';  // suspected prompt injection

/** Sources considered external (untrusted by default). */
export const EXTERNAL_SOURCES: ReadonlySet<ActionSource> = new Set([
  'external_text', 'webhook', 'skill_output', 'tool_return',
  'document', 'webpage', 'red_packet', 'prompt_injection',
]);

// ── Candidate Economic Action ────────────────────────────────────────

/**
 * A candidate economic action — produced from external or internal input.
 * Must pass through the Economic Instruction Firewall before execution.
 */
export interface CandidateEconomicAction {
  readonly id: string;
  readonly actionKind: EconomicActionKind;
  readonly source: ActionSource;
  readonly sourceContext: string;
  readonly amountCents: number;
  readonly asset: string;
  readonly recipient?: string;
  readonly purpose: string;
  readonly riskLevel: EconomicRiskLevel;
  readonly createdAt: string;
}

// ── Classification Result ────────────────────────────────────────────

export interface ActionClassification {
  readonly riskLevel: EconomicRiskLevel;
  readonly requiresMandate: boolean;
  readonly requiresHumanConfirmation: boolean;
  readonly isAutoExecutable: boolean;
}

/**
 * Classify an economic action kind into its governance properties.
 * Pure function — no side effects.
 */
export function classifyAction(actionKind: EconomicActionKind): ActionClassification {
  switch (actionKind) {
    case 'receive':
      return {
        riskLevel: 'low',
        requiresMandate: false,
        requiresHumanConfirmation: false,
        isAutoExecutable: true,
      };
    case 'claim_reward':
      return {
        riskLevel: 'medium-low',
        requiresMandate: false,
        requiresHumanConfirmation: false,
        isAutoExecutable: true,
      };
    case 'spend_within_mandate':
      return {
        riskLevel: 'medium',
        requiresMandate: true,
        requiresHumanConfirmation: false,
        isAutoExecutable: false, // only within matching mandate
      };
    case 'explicit_transfer':
      return {
        riskLevel: 'critical',
        requiresMandate: true,
        requiresHumanConfirmation: true,
        isAutoExecutable: false,
      };
  }
}

// ── Candidate Factory ────────────────────────────────────────────────

let candidateIdCounter = 0;

/** Create a CandidateEconomicAction with auto-generated ID and risk level. */
export function createCandidate(
  input: Omit<CandidateEconomicAction, 'id' | 'riskLevel' | 'createdAt'>,
): CandidateEconomicAction {
  return {
    id: `candidate_${++candidateIdCounter}`,
    ...input,
    riskLevel: ACTION_RISK_DEFAULTS[input.actionKind],
    createdAt: new Date().toISOString(),
  };
}
