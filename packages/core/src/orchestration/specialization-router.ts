/**
 * Round 20.5 → 20.6 — SpecializationRouter (G3)
 *
 * Transforms specialization from manifest contract to runtime routing.
 * Consumes SessionRegistry evidence (manifests + evaluations) to make
 * routing decisions.
 *
 * Round 20.6 additions:
 * - enforceRouting(): pre-flight gate for spawn decisions
 * - Enforcement history tracking for truth surface
 * - enforcementSnapshot() for organism control surface
 *
 * Consumed by:
 * - ChildOutcomeMerger (follow-up routing)
 * - Spawn flow (child creation — must pass enforceRouting)
 * - Governance (interpretation / explanation)
 * - SessionRegistry (organism control surface)
 */
import type { ChildSessionManifest } from './child-session.js';
import type { SessionRegistry } from './session-registry.js';
import type { ChildOutcomeEvaluation } from './child-outcome-merger.js';

// ── Types ────────────────────────────────────────────────────────────

export interface TaskRequirement {
  /** What the task needs done */
  readonly task: string;
  /** Required capabilities */
  readonly requiredCapabilities?: string[];
  /** Required tool categories */
  readonly requiredToolCategories?: string[];
  /** Preferred specialization tag */
  readonly preferredSpecialization?: string;
  /** Minimum quality threshold (0-100) */
  readonly minQualityThreshold?: number;
}

export interface RoutingMatch {
  /** Session ID of the matched child */
  readonly sessionId: string;
  /** Specialization tag */
  readonly specialization: string;
  /** Match score (0-100) */
  readonly score: number;
  /** Breakdown of how score was computed */
  readonly scoreBreakdown: {
    readonly specializationMatch: number;
    readonly capabilityMatch: number;
    readonly toolCategoryMatch: number;
    readonly historicalQuality: number;
  };
  /** The manifest that was matched */
  readonly manifest: ChildSessionManifest;
}

export interface ManifestRecommendation {
  /** Recommended manifest for spawning */
  readonly manifest: Partial<ChildSessionManifest>;
  /** Confidence (0-1) */
  readonly confidence: number;
  /** Rationale */
  readonly rationale: string;
  /** Based on how many historical sessions */
  readonly basedOnSessions: number;
}

// ── Round 20.6: Routing Enforcement Types ────────────────────────

export interface RoutingEnforcementResult {
  readonly allowed: boolean;
  readonly reason: string;
  readonly warnings: string[];
  readonly suggestedAlternative?: ManifestRecommendation;
  readonly suggestReuseSessionId?: string;
  readonly enforcedAt: string;
}

export interface RoutingEnforcementRecord {
  readonly specialization: string;
  readonly allowed: boolean;
  readonly reason: string;
  readonly enforcedAt: string;
}

// ── SpecializationRouter ────────────────────────────────────────────

export class SpecializationRouter {
  private registry: SessionRegistry;
  /** Round 20.6: Enforcement decision history */
  private _enforcementHistory: RoutingEnforcementRecord[] = [];

  constructor(registry: SessionRegistry) {
    this.registry = registry;
  }

  /**
   * Find the best-matching specialization from child history.
   * Returns matches sorted by score (highest first).
   */
  matchSpecialization(requirement: TaskRequirement): RoutingMatch[] {
    const sessions = this.registry.listSessions();
    const matches: RoutingMatch[] = [];

    for (const session of sessions) {
      const manifest = session.manifest;
      if (!manifest.specialization) continue;

      const score = this.scoreMatch(manifest, requirement, session.id);
      if (score.total > 0) {
        matches.push({
          sessionId: session.id,
          specialization: manifest.specialization,
          score: score.total,
          scoreBreakdown: {
            specializationMatch: score.specialization,
            capabilityMatch: score.capability,
            toolCategoryMatch: score.toolCategory,
            historicalQuality: score.quality,
          },
          manifest,
        });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * Recommend a manifest for a new child spawn based on historical performance.
   */
  recommendSpawnManifest(requirement: TaskRequirement): ManifestRecommendation {
    const matches = this.matchSpecialization(requirement);

    if (matches.length === 0) {
      // No history — build from requirement
      return {
        manifest: {
          role: 'worker',
          task: requirement.task,
          expectedCapabilities: requirement.requiredCapabilities,
          allowedToolCategories: requirement.requiredToolCategories,
          specialization: requirement.preferredSpecialization,
        },
        confidence: 0.3,
        rationale: 'No matching historical sessions — using requirement as-is',
        basedOnSessions: 0,
      };
    }

    // Use best match as template
    const best = matches[0];
    const evaluation = this.registry.getEvaluation(best.sessionId);

    // Build recommended manifest from best match + requirement
    const manifest: Partial<ChildSessionManifest> = {
      role: best.manifest.role,
      task: requirement.task,
      specialization: best.specialization,
      expectedCapabilities: this.mergeCapabilities(
        best.manifest.expectedCapabilities,
        requirement.requiredCapabilities,
      ),
      allowedToolCategories: this.mergeCapabilities(
        best.manifest.allowedToolCategories,
        requirement.requiredToolCategories,
      ),
      reportingExpectation: best.manifest.reportingExpectation,
    };

    const confidence = Math.min(0.95, best.score / 100);
    const qualityNote = evaluation
      ? ` (historical quality: ${evaluation.completionQuality})`
      : '';

    return {
      manifest,
      confidence: Math.round(confidence * 100) / 100,
      rationale: `Based on ${matches.length} historical session(s), best match: ${best.specialization}${qualityNote}`,
      basedOnSessions: matches.length,
    };
  }

  /**
   * Score how well a specific session fits a requirement.
   * Returns 0-100.
   */
  evaluateRouting(sessionId: string, requirement: TaskRequirement): number {
    const session = this.registry.getSession(sessionId);
    if (!session) return 0;

    const score = this.scoreMatch(session.manifest, requirement, sessionId);
    return score.total;
  }

  /**
   * Get a snapshot of available specializations and their performance.
   */
  specializationSnapshot(): Array<{
    specialization: string;
    sessionCount: number;
    avgQuality: number;
    avgEffectiveness: number;
  }> {
    const sessions = this.registry.listSessions();
    const specMap = new Map<string, { count: number; qualitySum: number; effectivenessSum: number }>();

    for (const session of sessions) {
      const spec = session.manifest.specialization;
      if (!spec) continue;

      const entry = specMap.get(spec) ?? { count: 0, qualitySum: 0, effectivenessSum: 0 };
      entry.count++;

      const evaluation = this.registry.getEvaluation(session.id);
      if (evaluation) {
        entry.qualitySum += evaluation.completionQuality;
        entry.effectivenessSum += evaluation.effectivenessRatio;
      }

      specMap.set(spec, entry);
    }

    return Array.from(specMap.entries()).map(([spec, data]) => ({
      specialization: spec,
      sessionCount: data.count,
      avgQuality: data.count > 0 ? Math.round(data.qualitySum / data.count) : 0,
      avgEffectiveness: data.count > 0 ? Math.round((data.effectivenessSum / data.count) * 100) / 100 : 0,
    }));
  }

  // ── Private Scoring ──────────────────────────────────────────────

  private scoreMatch(
    manifest: ChildSessionManifest,
    requirement: TaskRequirement,
    sessionId: string,
  ): { total: number; specialization: number; capability: number; toolCategory: number; quality: number } {
    let specialization = 0;
    let capability = 0;
    let toolCategory = 0;
    let quality = 0;

    // 1. Specialization tag match (0-40)
    if (manifest.specialization && requirement.preferredSpecialization) {
      if (manifest.specialization === requirement.preferredSpecialization) {
        specialization = 40;
      } else if (manifest.specialization.includes(requirement.preferredSpecialization)
        || requirement.preferredSpecialization.includes(manifest.specialization)) {
        specialization = 20; // partial match
      }
    }

    // 2. Capability overlap (0-30)
    if (manifest.expectedCapabilities && requirement.requiredCapabilities) {
      const overlap = manifest.expectedCapabilities.filter(
        c => requirement.requiredCapabilities!.includes(c),
      ).length;
      const total = requirement.requiredCapabilities.length;
      capability = total > 0 ? Math.round((overlap / total) * 30) : 0;
    }

    // 3. Tool category overlap (0-15)
    if (manifest.allowedToolCategories && requirement.requiredToolCategories) {
      const overlap = manifest.allowedToolCategories.filter(
        c => requirement.requiredToolCategories!.includes(c),
      ).length;
      const total = requirement.requiredToolCategories.length;
      toolCategory = total > 0 ? Math.round((overlap / total) * 15) : 0;
    }

    // 4. Historical quality (0-15)
    const evaluation = this.registry.getEvaluation(sessionId);
    if (evaluation) {
      quality = Math.round((evaluation.completionQuality / 100) * 15);
      // Apply minimum quality threshold filter
      if (requirement.minQualityThreshold && evaluation.completionQuality < requirement.minQualityThreshold) {
        return { total: 0, specialization: 0, capability: 0, toolCategory: 0, quality: 0 };
      }
    }

    const total = specialization + capability + toolCategory + quality;
    return { total, specialization, capability, toolCategory, quality };
  }

  private mergeCapabilities(existing?: string[], required?: string[]): string[] {
    const set = new Set<string>();
    if (existing) existing.forEach(c => set.add(c));
    if (required) required.forEach(c => set.add(c));
    return Array.from(set);
  }

  // ── Round 20.6: Routing Enforcement ─────────────────────────────

  /**
   * Pre-flight enforcement gate for spawn decisions.
   * Must be called before creating a new child session.
   *
   * Rules:
   * 1. Quality gate: specialization with avg quality < 30 → reject
   * 2. Avoid-list: specialization with ≥2 recent high/critical failures → reject
   * 3. Reuse suggestion: completed session with same spec scored ≥70 → suggest reuse
   * 4. Capability mismatch: requirement provided but critical caps missing → warn
   */
  enforceRouting(
    manifest: ChildSessionManifest,
    requirement?: TaskRequirement,
  ): RoutingEnforcementResult {
    const now = new Date().toISOString();
    const warnings: string[] = [];
    const spec = manifest.specialization ?? 'unspecialized';

    // 1. Quality gate: check historical quality for this specialization
    const snapshot = this.specializationSnapshot();
    const specEntry = snapshot.find(s => s.specialization === spec);
    if (specEntry && specEntry.sessionCount >= 2 && specEntry.avgQuality < 30) {
      const result: RoutingEnforcementResult = {
        allowed: false,
        reason: `Specialization '${spec}' has poor historical quality (avg=${specEntry.avgQuality}, sessions=${specEntry.sessionCount})`,
        warnings: [],
        enforcedAt: now,
      };
      this.recordEnforcement(spec, result);
      return result;
    }

    // 2. Avoid-list: check for recent high/critical failures
    const sessions = this.registry.listSessions();
    const recentFailures = sessions.filter(s => {
      if (s.manifest.specialization !== spec) return false;
      if (s.status !== 'failed') return false;
      const evaluation = this.registry.getEvaluation(s.id);
      return evaluation && (evaluation.failureSeverity === 'critical' || evaluation.failureSeverity === 'high');
    });
    if (recentFailures.length >= 2) {
      const result: RoutingEnforcementResult = {
        allowed: false,
        reason: `Specialization '${spec}' has ${recentFailures.length} recent high-severity failures — avoid reuse`,
        warnings: [],
        enforcedAt: now,
      };
      this.recordEnforcement(spec, result);
      return result;
    }

    // 3. Capability mismatch warning
    if (requirement?.requiredCapabilities && manifest.expectedCapabilities) {
      const missing = requirement.requiredCapabilities.filter(
        c => !manifest.expectedCapabilities!.includes(c),
      );
      if (missing.length > 0) {
        warnings.push(`Missing capabilities: ${missing.join(', ')}`);
      }
    }

    // 4. Reuse suggestion: find a high-quality completed session with same spec
    let suggestReuseSessionId: string | undefined;
    let suggestedAlternative: ManifestRecommendation | undefined;
    const completedSameSec = sessions.filter(
      s => s.manifest.specialization === spec && s.status === 'completed',
    );
    for (const s of completedSameSec) {
      const evaluation = this.registry.getEvaluation(s.id);
      if (evaluation && evaluation.completionQuality >= 70) {
        suggestReuseSessionId = s.id;
        break;
      }
    }

    // If quality gate warns but doesn't reject, suggest alternative
    if (specEntry && specEntry.avgQuality < 50 && specEntry.sessionCount >= 2) {
      warnings.push(`Specialization '${spec}' has below-average quality (avg=${specEntry.avgQuality})`);
      if (requirement) {
        suggestedAlternative = this.recommendSpawnManifest(requirement);
      }
    }

    const result: RoutingEnforcementResult = {
      allowed: true,
      reason: warnings.length > 0
        ? `Allowed with ${warnings.length} warning(s)`
        : 'Routing check passed',
      warnings,
      suggestedAlternative,
      suggestReuseSessionId,
      enforcedAt: now,
    };
    this.recordEnforcement(spec, result);
    return result;
  }

  /**
   * Get recent enforcement decisions for organism control surface.
   */
  enforcementSnapshot(limit = 20): readonly RoutingEnforcementRecord[] {
    return this._enforcementHistory.slice(-limit);
  }

  private recordEnforcement(specialization: string, result: RoutingEnforcementResult): void {
    this._enforcementHistory.push({
      specialization,
      allowed: result.allowed,
      reason: result.reason,
      enforcedAt: result.enforcedAt,
    });
  }
}
