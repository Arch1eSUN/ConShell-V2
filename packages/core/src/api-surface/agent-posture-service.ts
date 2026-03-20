/**
 * AgentPostureService — Round 19.4
 *
 * Unified truth surface that aggregates posture from all subsystems
 * into a single, machine-readable snapshot. This is the P6 closure:
 * internal truth → externally consumable posture.
 *
 * Aggregates:
 * - Identity/Continuity state
 * - Economic health (survival tier, balance, burn rate)
 * - Governance status (pending proposals, recent verdicts)
 * - Lineage health (active children, degraded, funding at risk)
 * - Collective health (peer counts, trust distribution, delegation rate)
 * - Self-modification status (quarantine, pending reviews)
 *
 * "Before you can show truth to others, you must first assemble it for yourself."
 */

// ── Posture Snapshot Types ───────────────────────────────────────────

export interface AgentPosture {
  readonly agentId: string;
  readonly timestamp: string;
  readonly version: string;

  // Identity
  readonly identity: IdentityPosture;

  // Economic
  readonly economic: EconomicPosture;

  // Lineage
  readonly lineage: LineagePosture;

  // Collective
  readonly collective: CollectivePosture;

  // Governance
  readonly governance: GovernancePosture;

  // Agenda (Round 19.8)
  readonly agenda: AgendaPosture;

  // Overall health
  readonly overallHealthScore: number; // 0-100
  readonly healthVerdict: 'healthy' | 'degraded' | 'critical' | 'terminal';
}

export interface IdentityPosture {
  readonly mode: string; // 'genesis' | 'restart' | 'degraded'
  readonly chainValid: boolean;
  readonly chainLength: number;
  readonly soulDrifted: boolean;
  readonly fingerprint: string;
}

export interface EconomicPosture {
  readonly survivalTier: string;
  readonly balanceCents: number;
  readonly burnRateCentsPerDay: number;
  readonly runwayDays: number;
  readonly profitabilityRatio: number;
}

export interface LineagePosture {
  readonly activeChildren: number;
  readonly degradedChildren: number;
  readonly totalFundingAllocated: number;
  readonly totalFundingSpent: number;
  readonly healthScore: number;
}

export interface CollectivePosture {
  readonly totalPeers: number;
  readonly trustedPeers: number;
  readonly degradedPeers: number;
  readonly delegationSuccessRate: number;
}

export interface GovernancePosture {
  readonly pendingProposals: number;
  readonly recentVerdicts: number;
  readonly selfModQuarantined: boolean;
}

// Round 19.8: Agenda truth — lifeform closure visibility
export interface AgendaPosture {
  readonly scheduled: number;
  readonly deferred: number;
  readonly active: number;
  readonly blocked: number;
  readonly nextCommitmentHint: string;
  readonly priorityReason: string;
}

// ── Provider Interfaces ──────────────────────────────────────────────

export interface IdentityPostureProvider {
  getPosture(): IdentityPosture;
}

export interface EconomicPostureProvider {
  getPosture(): EconomicPosture;
}

export interface LineagePostureProvider {
  getPosture(): LineagePosture;
}

export interface CollectivePostureProvider {
  getPosture(): CollectivePosture;
}

export interface GovernancePostureProvider {
  getPosture(): GovernancePosture;
}

export interface AgendaPostureProvider {
  getPosture(): AgendaPosture;
}

// ── AgentPostureService ──────────────────────────────────────────────

export class AgentPostureService {
  private snapshotHistory: AgentPosture[] = [];
  private maxHistory = 50;

  constructor(
    private agentId: string,
    private version: string,
    private providers: {
      identity: IdentityPostureProvider;
      economic: EconomicPostureProvider;
      lineage: LineagePostureProvider;
      collective: CollectivePostureProvider;
      governance: GovernancePostureProvider;
      agenda: AgendaPostureProvider;
    },
  ) {}

  /**
   * Assemble a full posture snapshot from all subsystems.
   */
  snapshot(): AgentPosture {
    const identity = this.providers.identity.getPosture();
    const economic = this.providers.economic.getPosture();
    const lineage = this.providers.lineage.getPosture();
    const collective = this.providers.collective.getPosture();
    const governance = this.providers.governance.getPosture();
    const agenda = this.providers.agenda.getPosture();

    const overallHealthScore = this.computeOverallHealth(
      identity, economic, lineage, collective, governance, agenda,
    );

    const posture: AgentPosture = {
      agentId: this.agentId,
      timestamp: new Date().toISOString(),
      version: this.version,
      identity,
      economic,
      lineage,
      collective,
      governance,
      agenda,
      overallHealthScore,
      healthVerdict: this.verdictFromScore(overallHealthScore),
    };

    // Maintain bounded history
    this.snapshotHistory.push(posture);
    if (this.snapshotHistory.length > this.maxHistory) {
      this.snapshotHistory.shift();
    }

    return posture;
  }

  /**
   * Get the most recent posture without recomputing.
   */
  latest(): AgentPosture | null {
    return this.snapshotHistory.length > 0
      ? this.snapshotHistory[this.snapshotHistory.length - 1]!
      : null;
  }

  /**
   * Get posture history for trend analysis.
   */
  history(): readonly AgentPosture[] {
    return this.snapshotHistory;
  }

  // ── Health Computation ──────────────────────────────────────────────

  private computeOverallHealth(
    identity: IdentityPosture,
    economic: EconomicPosture,
    lineage: LineagePosture,
    collective: CollectivePosture,
    governance: GovernancePosture,
    agenda: AgendaPosture,
  ): number {
    let score = 100;

    // Identity penalties
    if (!identity.chainValid) score -= 30;
    if (identity.soulDrifted) score -= 10;
    if (identity.mode === 'degraded') score -= 20;

    // Economic penalties
    if (economic.survivalTier === 'terminal' || economic.survivalTier === 'dead') score -= 40;
    else if (economic.survivalTier === 'critical') score -= 25;
    else if (economic.survivalTier === 'austerity') score -= 10;

    if (economic.runwayDays < 3) score -= 15;
    else if (economic.runwayDays < 7) score -= 5;

    // Lineage penalties
    if (lineage.healthScore < 50) score -= 10;
    if (lineage.degradedChildren > 0) score -= 5 * Math.min(lineage.degradedChildren, 3);

    // Collective penalties
    if (collective.delegationSuccessRate < 0.5 && collective.totalPeers > 0) score -= 10;
    if (collective.degradedPeers > 2) score -= 5;

    // Governance penalties
    if (governance.selfModQuarantined) score -= 15;

    // Agenda penalties (Round 19.8)
    if (agenda.blocked > 0) score -= 5 * Math.min(agenda.blocked, 3);
    if (agenda.deferred > agenda.scheduled && agenda.scheduled > 0) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  private verdictFromScore(score: number): AgentPosture['healthVerdict'] {
    if (score >= 80) return 'healthy';
    if (score >= 50) return 'degraded';
    if (score >= 20) return 'critical';
    return 'terminal';
  }
}
