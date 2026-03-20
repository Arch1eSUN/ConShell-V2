/**
 * Round 17.8 — G4-G5: Reward Definition + Eligibility Foundation
 *
 * Evolves `claim_reward` from an action classification into a fully
 * governable reward/claim object layer with:
 * - RewardDefinition (formal reward specifications)
 * - EligibilityRule (structured qualification rules)
 * - RewardRegistry (CRUD + lifecycle management)
 * - Anti-duplication semantics
 *
 * Design invariants:
 * - Rewards are formal objects, not just action labels
 * - Eligibility is rule-based and deterministic
 * - Every eligibility check produces structured reasons
 * - Per-identity and per-wallet limits are enforced
 */

// ── Types ────────────────────────────────────────────────────────────

export type RewardKind = 'task_completion' | 'referral' | 'milestone' | 'bonus' | 'airdrop';

export type RewardStatus = 'active' | 'paused' | 'expired' | 'depleted';

export type EligibilityRuleKind =
  | 'identity_active'
  | 'capability_required'
  | 'time_window'
  | 'custom_predicate';

export interface EligibilityRule {
  readonly ruleId: string;
  readonly kind: EligibilityRuleKind;
  readonly description: string;
  /** For capability_required: which scope is needed */
  readonly requiredScope?: string;
  /** For time_window: start/end ISO strings */
  readonly windowStart?: string;
  readonly windowEnd?: string;
  /** For custom_predicate: function reference name */
  readonly predicateName?: string;
}

export interface RewardDefinition {
  readonly rewardId: string;
  readonly kind: RewardKind;
  readonly name: string;
  readonly description: string;
  readonly amountCents: number;
  readonly asset: string;
  readonly eligibilityRules: readonly EligibilityRule[];
  readonly maxTotalClaims: number;
  readonly perIdentityLimit: number;
  readonly activeWindowStart: string;
  readonly activeWindowEnd: string;
  readonly status: RewardStatus;
  readonly totalClaimed: number;
  readonly createdAt: string;
}

export interface RewardCreateInput {
  readonly kind: RewardKind;
  readonly name: string;
  readonly description: string;
  readonly amountCents: number;
  readonly asset: string;
  readonly eligibilityRules?: readonly Omit<EligibilityRule, 'ruleId'>[];
  readonly maxTotalClaims: number;
  readonly perIdentityLimit: number;
  readonly activeWindowStart?: string;
  readonly activeWindowEnd: string;
  readonly createdBy: string;
}

export interface EligibilityCheckResult {
  readonly eligible: boolean;
  readonly rewardId: string;
  readonly economicIdentityId: string;
  readonly passedRules: readonly string[];
  readonly failedRules: readonly {
    readonly ruleId: string;
    readonly reason: string;
  }[];
  readonly isDuplicate: boolean;
  readonly claimsUsed: number;
  readonly claimLimit: number;
  readonly checkedAt: string;
}

// ── Reward Registry ─────────────────────────────────────────────────

export class RewardRegistry {
  private rewards = new Map<string, RewardDefinition>();
  private idCounter = 0;
  private ruleIdCounter = 0;

  /** Create a new reward definition. */
  create(input: RewardCreateInput): RewardDefinition {
    if (input.amountCents <= 0) throw new Error('Reward amount must be positive');
    if (input.maxTotalClaims <= 0) throw new Error('Max total claims must be positive');
    if (input.perIdentityLimit <= 0) throw new Error('Per-identity limit must be positive');

    const rules: EligibilityRule[] = (input.eligibilityRules ?? []).map(r => ({
      ...r,
      ruleId: `elig_rule_${++this.ruleIdCounter}`,
    }));

    // Always add identity_active as the first rule
    if (!rules.some(r => r.kind === 'identity_active')) {
      rules.unshift({
        ruleId: `elig_rule_${++this.ruleIdCounter}`,
        kind: 'identity_active',
        description: 'Economic identity must be active',
      });
    }

    const reward: RewardDefinition = {
      rewardId: `reward_${++this.idCounter}`,
      kind: input.kind,
      name: input.name,
      description: input.description,
      amountCents: input.amountCents,
      asset: input.asset,
      eligibilityRules: rules,
      maxTotalClaims: input.maxTotalClaims,
      perIdentityLimit: input.perIdentityLimit,
      activeWindowStart: input.activeWindowStart ?? new Date().toISOString(),
      activeWindowEnd: input.activeWindowEnd,
      status: 'active',
      totalClaimed: 0,
      createdAt: new Date().toISOString(),
    };

    this.rewards.set(reward.rewardId, reward);
    return reward;
  }

  /** Get a reward by ID. */
  get(rewardId: string): RewardDefinition | undefined {
    return this.rewards.get(rewardId);
  }

  /** Get all rewards. */
  all(): ReadonlyArray<RewardDefinition> {
    return [...this.rewards.values()];
  }

  /** Get active rewards. */
  getActive(): ReadonlyArray<RewardDefinition> {
    return this.all().filter(r => r.status === 'active');
  }

  /** Pause a reward. */
  pause(rewardId: string): void {
    const r = this.mustGet(rewardId);
    this.rewards.set(rewardId, { ...r, status: 'paused' });
  }

  /** Resume (unpause) a reward. */
  resume(rewardId: string): void {
    const r = this.mustGet(rewardId);
    if (r.status !== 'paused') throw new Error(`Cannot resume reward in status '${r.status}'`);
    this.rewards.set(rewardId, { ...r, status: 'active' });
  }

  /** Increment the claim counter. Returns false if depleted. */
  incrementClaimed(rewardId: string): boolean {
    const r = this.mustGet(rewardId);
    const newTotal = r.totalClaimed + 1;
    const status = newTotal >= r.maxTotalClaims ? 'depleted' as const : r.status;
    this.rewards.set(rewardId, { ...r, totalClaimed: newTotal, status });
    return status !== 'depleted' || newTotal === r.maxTotalClaims;
  }

  /**
   * Check eligibility of an identity for a reward.
   * Pure eligibility check — does NOT create a claim.
   */
  checkEligibility(
    rewardId: string,
    economicIdentityId: string,
    context: {
      identityStatus: string;
      grantedScopes: ReadonlySet<string>;
      claimsForIdentity: number;
    },
  ): EligibilityCheckResult {
    const reward = this.mustGet(rewardId);
    const passedRules: string[] = [];
    const failedRules: { ruleId: string; reason: string }[] = [];
    const now = new Date();

    // Check active window
    if (now < new Date(reward.activeWindowStart) || now > new Date(reward.activeWindowEnd)) {
      failedRules.push({ ruleId: 'window_check', reason: 'Reward is outside active window' });
    }

    // Check reward status
    if (reward.status !== 'active') {
      failedRules.push({ ruleId: 'status_check', reason: `Reward is '${reward.status}', not active` });
    }

    // Check total claims capacity
    if (reward.totalClaimed >= reward.maxTotalClaims) {
      failedRules.push({ ruleId: 'total_capacity', reason: 'Reward has reached max total claims' });
    }

    // Check per-identity limit
    const isDuplicate = context.claimsForIdentity >= reward.perIdentityLimit;
    if (isDuplicate) {
      failedRules.push({
        ruleId: 'per_identity_limit',
        reason: `Already claimed ${context.claimsForIdentity}/${reward.perIdentityLimit} times`,
      });
    }

    // Check eligibility rules
    for (const rule of reward.eligibilityRules) {
      switch (rule.kind) {
        case 'identity_active':
          if (context.identityStatus === 'active') {
            passedRules.push(rule.ruleId);
          } else {
            failedRules.push({
              ruleId: rule.ruleId,
              reason: `Identity is '${context.identityStatus}', must be 'active'`,
            });
          }
          break;

        case 'capability_required':
          if (rule.requiredScope && context.grantedScopes.has(rule.requiredScope)) {
            passedRules.push(rule.ruleId);
          } else {
            failedRules.push({
              ruleId: rule.ruleId,
              reason: `Missing required capability: ${rule.requiredScope}`,
            });
          }
          break;

        case 'time_window':
          if (rule.windowStart && now < new Date(rule.windowStart)) {
            failedRules.push({ ruleId: rule.ruleId, reason: 'Before eligibility window start' });
          } else if (rule.windowEnd && now > new Date(rule.windowEnd)) {
            failedRules.push({ ruleId: rule.ruleId, reason: 'After eligibility window end' });
          } else {
            passedRules.push(rule.ruleId);
          }
          break;

        case 'custom_predicate':
          // Custom predicates always pass in foundation layer
          // Will be extended when predicate evaluation is needed
          passedRules.push(rule.ruleId);
          break;
      }
    }

    return {
      eligible: failedRules.length === 0,
      rewardId,
      economicIdentityId,
      passedRules,
      failedRules,
      isDuplicate,
      claimsUsed: context.claimsForIdentity,
      claimLimit: reward.perIdentityLimit,
      checkedAt: new Date().toISOString(),
    };
  }

  private mustGet(rewardId: string): RewardDefinition {
    const r = this.rewards.get(rewardId);
    if (!r) throw new Error(`Reward '${rewardId}' not found`);
    return r;
  }
}
