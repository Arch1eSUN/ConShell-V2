/**
 * Round 20.1 → 20.8 — SessionRegistry
 *
 * Unified container managing ChildSessions, ToolInvocations,
 * ChildFundingLeases, progress reports, governance actions,
 * outcome evaluations, and merge results as first-class
 * runtime primitives.
 *
 * Round 20.4 additions:
 * - Lease management (registerLease, getLease, getSessionLease, listLeases)
 * - Reporting aggregation (submitReport, getReports, getLatestReport)
 * - Governance action tracking (recordGovernanceAction, getGovernanceActions)
 * - childRuntimeSummary() for truth surface consumption
 *
 * Round 20.5 additions:
 * - Evaluation storage (submitEvaluation, getEvaluation, listEvaluations)
 * - Merge result storage (submitMergeResult, getMergeResults)
 * - Enhanced childRuntimeSummary with organism closure data
 *
 * Round 20.6 additions:
 * - organismControlSurface() — actionable operator control view
 * - Commitment impact trail, spend closure verification,
 *   routing enforcement snapshot, merge consequence distribution
 */
import { ChildSession, type ChildSessionStatus, type ChildGovernanceAction } from './child-session.js';
import { ToolInvocation, type ToolInvocationStatus } from './tool-invocation.js';
import { ChildFundingLease } from './child-funding-lease.js';
import type { ChildOutcomeEvaluation, ChildMergeResult, CommitmentMutationType, MergeType, LinkageResolution } from './child-outcome-merger.js';
import type { SpecializationRouter, RoutingEnforcementRecord } from './specialization-router.js';
import type { OrganismInterventionService, InterventionSnapshot, GovernanceAction } from './organism-intervention-service.js';

// ── Reporting Types (Round 20.4 G2) ─────────────────────────────────

export type ProgressReportKind = 'heartbeat' | 'checkpoint' | 'outcome';

export interface ChildProgressReport {
  readonly sessionId: string;
  readonly kind: ProgressReportKind;
  readonly progress: number;          // 0-100
  readonly budgetUsedCents: number;
  readonly checkpoint?: string;
  readonly findings?: string;
  readonly risks?: string[];
  readonly reportedAt: string;
}

// ── Diagnostics ─────────────────────────────────────────────────────

export interface SessionRegistryDiagnostics {
  totalSessions: number;
  sessionsByStatus: Record<string, number>;
  totalInvocations: number;
  invocationsByStatus: Record<string, number>;
  invocationsByOrigin: Record<string, number>;
  activeBudgetCents: number;
  usedBudgetCents: number;
  // Round 20.4
  totalLeases: number;
  leasesByStatus: Record<string, number>;
  totalReports: number;
  totalGovernanceActions: number;
  // Round 20.5
  totalEvaluations: number;
  totalMergeResults: number;
  mergesByType: Record<string, number>;
}

// ── Child Runtime Summary (Round 20.4 G5) ───────────────────────────

export interface ChildRuntimeSummary {
  activeChildren: number;
  totalChildren: number;
  statusBreakdown: Record<string, number>;
  leaseSummary: {
    totalAllocatedCents: number;
    totalSpentCents: number;
    activeLeases: number;
  };
  recentOutcomes: Array<{
    sessionId: string;
    name: string;
    status: ChildSessionStatus;
    completedAt?: string;
  }>;
  recentGovernanceActions: ChildGovernanceAction[];
  // Round 20.5: Organism closure data
  recentMergeResults: ChildMergeResult[];
  utilitySummary: {
    totalExpectedCents: number;
    totalRealizedCents: number;
    avgEffectivenessRatio: number;
  };
  generatedAt: string;
}

// ── Organism Control Surface (Round 20.6 G4) ───────────────────────

export interface CommitmentImpactEntry {
  readonly sessionId: string;
  readonly mergeType: MergeType;
  readonly commitmentMutationType: CommitmentMutationType;
  readonly targetCommitmentId?: string;
  readonly createdCommitmentId?: string;
}

export interface SpendClosureEntry {
  readonly sessionId: string;
  readonly leaseSpentCents: number;
  readonly sessionSpentCents: number;
  readonly aligned: boolean;
  readonly hasCanonicalSpendTruth: boolean;
}

export interface OrganismControlSurface {
  /** Trail of commitment mutations from child outcomes */
  readonly commitmentImpactTrail: CommitmentImpactEntry[];
  /** Per-session spend closure alignment */
  readonly spendClosureStatus: SpendClosureEntry[];
  /** Recent routing enforcement decisions */
  readonly routingEnforcementSnapshot: readonly RoutingEnforcementRecord[];
  /** Distribution of merge types and their resulting commitment IDs */
  readonly mergeConsequenceDistribution: Record<string, { count: number; commitmentIds: string[] }>;
  /** High-level health indicators */
  readonly overallHealth: {
    deepClosureActive: boolean;
    spendTruthUnified: boolean;
    routingEnforced: boolean;
  };
  /** Round 20.7: Intervention history from OrganismInterventionService */
  readonly interventionSnapshot?: InterventionSnapshot;
  readonly generatedAt: string;
}

// ── Organism Lineage Graph (Round 20.7 G4) ───────────────────────────

export type OrganismEdgeType =
  | 'parent-child'
  | 'reuse'
  | 'specialization-evolution'
  | 'commitment-linkage'
  | 'intervention'
  | 'action-consequence';

export interface OrganismGraphNode {
  readonly sessionId: string;
  readonly name: string;
  readonly specialization?: string;
  readonly status: ChildSessionStatus;
  readonly evaluation?: ChildOutcomeEvaluation;
  readonly mergeResult?: ChildMergeResult;
  readonly targetCommitmentId?: string;
  /** Round 20.8 G4: Actions targeting this session */
  readonly interventionActions?: readonly GovernanceAction[];
}

export interface OrganismGraphEdge {
  readonly from: string;
  readonly to: string;
  readonly type: OrganismEdgeType;
  readonly label?: string;
}

export interface OrganismLineageGraph {
  readonly nodes: OrganismGraphNode[];
  readonly edges: OrganismGraphEdge[];
  readonly stats: {
    totalNodes: number;
    totalEdges: number;
    maxDepth: number;
    edgesByType: Record<string, number>;
  };
  readonly generatedAt: string;
}

// ── Registry ────────────────────────────────────────────────────────

export class SessionRegistry {
  private sessions = new Map<string, ChildSession>();
  private invocations = new Map<string, ToolInvocation>();
  private leases = new Map<string, ChildFundingLease>();
  private reports = new Map<string, ChildProgressReport[]>();
  private governanceActions: ChildGovernanceAction[] = [];
  // Round 20.5
  private evaluations = new Map<string, ChildOutcomeEvaluation>();
  private mergeResults: ChildMergeResult[] = [];

  // ── Session Management ──────────────────────────────────────────

  registerSession(session: ChildSession): void {
    this.sessions.set(session.id, session);
  }

  getSession(id: string): ChildSession | undefined {
    return this.sessions.get(id);
  }

  listSessions(filter?: { status?: ChildSessionStatus; parentSessionId?: string }): ChildSession[] {
    let results = Array.from(this.sessions.values());
    if (filter?.status) results = results.filter(s => s.status === filter.status);
    if (filter?.parentSessionId) results = results.filter(s => s.parentSessionId === filter.parentSessionId);
    return results;
  }

  removeSession(id: string): boolean {
    return this.sessions.delete(id);
  }

  // ── Lease Management (Round 20.4 G1) ────────────────────────────

  registerLease(lease: ChildFundingLease): void {
    this.leases.set(lease.leaseId, lease);
  }

  getLease(leaseId: string): ChildFundingLease | undefined {
    return this.leases.get(leaseId);
  }

  getSessionLease(sessionId: string): ChildFundingLease | undefined {
    for (const lease of this.leases.values()) {
      if (lease.sessionId === sessionId) return lease;
    }
    return undefined;
  }

  listLeases(filter?: { status?: string }): ChildFundingLease[] {
    let results = Array.from(this.leases.values());
    if (filter?.status) results = results.filter(l => l.status === filter.status);
    return results;
  }

  // ── Reporting (Round 20.4 G2) ───────────────────────────────────

  submitReport(report: ChildProgressReport): void {
    const existing = this.reports.get(report.sessionId) ?? [];
    existing.push(report);
    this.reports.set(report.sessionId, existing);
  }

  getReports(sessionId: string): readonly ChildProgressReport[] {
    return this.reports.get(sessionId) ?? [];
  }

  getLatestReport(sessionId: string): ChildProgressReport | undefined {
    const reports = this.reports.get(sessionId);
    return reports && reports.length > 0 ? reports[reports.length - 1] : undefined;
  }

  // ── Governance Actions (Round 20.4 G3) ──────────────────────────

  recordGovernanceAction(action: ChildGovernanceAction): void {
    this.governanceActions.push(action);
  }

  getGovernanceActions(sessionId?: string): readonly ChildGovernanceAction[] {
    if (sessionId) {
      return this.governanceActions.filter(a => a.sessionId === sessionId);
    }
    return [...this.governanceActions];
  }

  // ── Evaluations (Round 20.5 G4) ─────────────────────────────────

  submitEvaluation(evaluation: ChildOutcomeEvaluation): void {
    this.evaluations.set(evaluation.sessionId, evaluation);
  }

  getEvaluation(sessionId: string): ChildOutcomeEvaluation | undefined {
    return this.evaluations.get(sessionId);
  }

  listEvaluations(): ChildOutcomeEvaluation[] {
    return Array.from(this.evaluations.values());
  }

  // ── Merge Results (Round 20.5 G1) ──────────────────────────────

  submitMergeResult(result: ChildMergeResult): void {
    this.mergeResults.push(result);
  }

  getMergeResults(sessionId?: string): readonly ChildMergeResult[] {
    if (sessionId) {
      return this.mergeResults.filter(r => r.sessionId === sessionId);
    }
    return [...this.mergeResults];
  }

  // ── Invocation Management ───────────────────────────────────────

  registerInvocation(invocation: ToolInvocation): void {
    this.invocations.set(invocation.id, invocation);
  }

  getInvocation(id: string): ToolInvocation | undefined {
    return this.invocations.get(id);
  }

  listInvocations(filter?: {
    status?: ToolInvocationStatus;
    parentSessionId?: string;
    origin?: string;
  }): ToolInvocation[] {
    let results = Array.from(this.invocations.values());
    if (filter?.status) results = results.filter(i => i.status === filter.status);
    if (filter?.parentSessionId) results = results.filter(i => i.parentSessionId === filter.parentSessionId);
    if (filter?.origin) results = results.filter(i => i.origin === filter.origin);
    return results;
  }

  removeInvocation(id: string): boolean {
    return this.invocations.delete(id);
  }

  // ── Cross-Entity Queries ────────────────────────────────────────

  getSessionInvocations(sessionId: string): ToolInvocation[] {
    return this.listInvocations({ parentSessionId: sessionId });
  }

  activeWorkCount(): number {
    const activeSessions = this.listSessions({ status: 'running' }).length +
                           this.listSessions({ status: 'pending' }).length;
    const activeInvocations = this.listInvocations({ status: 'running' }).length +
                              this.listInvocations({ status: 'pending' }).length;
    return activeSessions + activeInvocations;
  }

  // ── Child Runtime Summary (Round 20.4 G5) ───────────────────────

  childRuntimeSummary(): ChildRuntimeSummary {
    const sessions = Array.from(this.sessions.values());
    const allLeases = Array.from(this.leases.values());
    const now = new Date().toISOString();

    // Status breakdown
    const statusBreakdown: Record<string, number> = {};
    for (const s of sessions) {
      statusBreakdown[s.status] = (statusBreakdown[s.status] ?? 0) + 1;
    }

    // Lease summary
    let totalAllocated = 0;
    let totalSpent = 0;
    let activeLeaseCount = 0;
    for (const l of allLeases) {
      totalAllocated += l.allocatedCents;
      totalSpent += l.spentCents;
      if (l.status === 'active') activeLeaseCount++;
    }

    // Recent outcomes (last 5 terminal sessions)
    const terminal = sessions
      .filter(s => ['completed', 'failed', 'recalled'].includes(s.status))
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
      .slice(0, 5)
      .map(s => ({
        sessionId: s.id,
        name: s.name,
        status: s.status,
        completedAt: s.completedAt,
      }));

    // Round 20.5: Utility summary from evaluations
    const evals = Array.from(this.evaluations.values());
    let totalExpected = 0;
    let totalRealized = 0;
    for (const ev of evals) {
      totalExpected += ev.utilityExpectedCents;
      totalRealized += ev.utilityRealizedCents;
    }
    const avgEffectiveness = evals.length > 0
      ? Math.round((evals.reduce((s, e) => s + e.effectivenessRatio, 0) / evals.length) * 100) / 100
      : 0;

    return {
      activeChildren: this.listSessions({ status: 'running' }).length,
      totalChildren: sessions.length,
      statusBreakdown,
      leaseSummary: {
        totalAllocatedCents: totalAllocated,
        totalSpentCents: totalSpent,
        activeLeases: activeLeaseCount,
      },
      recentOutcomes: terminal,
      recentGovernanceActions: this.governanceActions.slice(-5),
      recentMergeResults: this.mergeResults.slice(-5),
      utilitySummary: {
        totalExpectedCents: totalExpected,
        totalRealizedCents: totalRealized,
        avgEffectivenessRatio: avgEffectiveness,
      },
      generatedAt: now,
    };
  }

  // ── Diagnostics ─────────────────────────────────────────────────

  diagnostics(): SessionRegistryDiagnostics {
    const sessions = Array.from(this.sessions.values());
    const invocations = Array.from(this.invocations.values());

    const sessionsByStatus: Record<string, number> = {};
    let activeBudget = 0;
    let usedBudget = 0;
    for (const s of sessions) {
      sessionsByStatus[s.status] = (sessionsByStatus[s.status] ?? 0) + 1;
      activeBudget += s.budgetCents;
      usedBudget += s.budgetUsedCents;
    }

    const invocationsByStatus: Record<string, number> = {};
    const invocationsByOrigin: Record<string, number> = {};
    for (const inv of invocations) {
      invocationsByStatus[inv.status] = (invocationsByStatus[inv.status] ?? 0) + 1;
      invocationsByOrigin[inv.origin] = (invocationsByOrigin[inv.origin] ?? 0) + 1;
    }

    const leasesByStatus: Record<string, number> = {};
    for (const l of this.leases.values()) {
      leasesByStatus[l.status] = (leasesByStatus[l.status] ?? 0) + 1;
    }

    let totalReportCount = 0;
    for (const rs of this.reports.values()) {
      totalReportCount += rs.length;
    }

    return {
      totalSessions: sessions.length,
      sessionsByStatus,
      totalInvocations: invocations.length,
      invocationsByStatus,
      invocationsByOrigin,
      activeBudgetCents: activeBudget,
      usedBudgetCents: usedBudget,
      totalLeases: this.leases.size,
      leasesByStatus,
      totalReports: totalReportCount,
      totalGovernanceActions: this.governanceActions.length,
      totalEvaluations: this.evaluations.size,
      totalMergeResults: this.mergeResults.length,
      mergesByType: this.mergeResults.reduce((acc, r) => {
        acc[r.mergeType] = (acc[r.mergeType] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  // ── Organism Control Surface (Round 20.6 G4) ───────────────────

  /**
   * Actionable operator control view.
   * Aggregates from existing data — no new fact sources.
   * Shows enforcement in action, not just summaries.
   */
  organismControlSurface(
    router?: SpecializationRouter,
    interventionService?: OrganismInterventionService,
  ): OrganismControlSurface {
    const now = new Date().toISOString();

    // 1. Commitment impact trail from merge results
    const commitmentImpactTrail: CommitmentImpactEntry[] = this.mergeResults
      .filter(r => r.commitmentMutationType !== 'none')
      .map(r => ({
        sessionId: r.sessionId,
        mergeType: r.mergeType,
        commitmentMutationType: r.commitmentMutationType,
        targetCommitmentId: r.targetCommitmentId,
        createdCommitmentId: r.createdCommitmentId,
      }));

    // 2. Spend closure verification
    const sessions = Array.from(this.sessions.values());
    const spendClosureStatus: SpendClosureEntry[] = sessions.map(s => {
      const lease = this.getSessionLease(s.id);
      const leaseSpent = lease?.spentCents ?? 0;
      const sessionSpent = s.budgetUsedCents;
      return {
        sessionId: s.id,
        leaseSpentCents: leaseSpent,
        sessionSpentCents: sessionSpent,
        aligned: !lease || leaseSpent === sessionSpent,
        hasCanonicalSpendTruth: s.hasCanonicalSpendTruth,
      };
    });

    // 3. Routing enforcement snapshot
    const routingEnforcementSnapshot = router?.enforcementSnapshot() ?? [];

    // 4. Merge consequence distribution
    const mergeConsequenceDistribution: Record<string, { count: number; commitmentIds: string[] }> = {};
    for (const r of this.mergeResults) {
      const entry = mergeConsequenceDistribution[r.mergeType] ?? { count: 0, commitmentIds: [] };
      entry.count++;
      if (r.targetCommitmentId) entry.commitmentIds.push(r.targetCommitmentId);
      if (r.createdCommitmentId) entry.commitmentIds.push(r.createdCommitmentId);
      mergeConsequenceDistribution[r.mergeType] = entry;
    }

    // 5. Overall health
    const hasDeepClosure = commitmentImpactTrail.length > 0;
    const allSpendAligned = spendClosureStatus.every(s => s.aligned);
    const hasEnforcement = routingEnforcementSnapshot.length > 0;

    return {
      commitmentImpactTrail,
      spendClosureStatus,
      routingEnforcementSnapshot,
      mergeConsequenceDistribution,
      overallHealth: {
        deepClosureActive: hasDeepClosure,
        spendTruthUnified: allSpendAligned,
        routingEnforced: hasEnforcement,
      },
      interventionSnapshot: interventionService?.interventionSnapshot(),
      generatedAt: now,
    };
  }

  // ── Organism Lineage Graph (Round 20.7 G4) ──────────────────────

  /**
   * Build explicit organism lineage graph from registry data.
   * No new fact sources — pure aggregation.
   */
  organismLineageGraph(router?: SpecializationRouter, interventionService?: OrganismInterventionService): OrganismLineageGraph {
    const now = new Date().toISOString();
    const sessions = Array.from(this.sessions.values());
    const nodes: OrganismGraphNode[] = [];
    const edges: OrganismGraphEdge[] = [];

    // Collect action history for node enrichment (G4)
    const allActions = interventionService?.listActions() ?? [];
    const actionsByTarget = new Map<string, GovernanceAction[]>();
    for (const a of allActions) {
      const existing = actionsByTarget.get(a.targetId) ?? [];
      existing.push(a);
      actionsByTarget.set(a.targetId, existing);
    }

    // Build nodes
    for (const s of sessions) {
      nodes.push({
        sessionId: s.id,
        name: s.name,
        specialization: s.manifest.specialization,
        status: s.status,
        evaluation: this.getEvaluation(s.id),
        mergeResult: this.mergeResults.find(r => r.sessionId === s.id),
        targetCommitmentId: s.targetCommitmentId,
        interventionActions: actionsByTarget.get(s.id),
      });
    }

    // Build edges
    const depthMap = new Map<string, number>();

    for (const s of sessions) {
      // 1. Parent-child edges
      if (s.parentSessionId && this.sessions.has(s.parentSessionId)) {
        edges.push({
          from: s.parentSessionId,
          to: s.id,
          type: 'parent-child',
        });
        depthMap.set(s.id, (depthMap.get(s.parentSessionId) ?? 0) + 1);
      } else {
        depthMap.set(s.id, 0);
      }

      // 2. Commitment linkage edges
      if (s.targetCommitmentId) {
        // Find other sessions targeting the same commitment
        const siblings = sessions.filter(
          other => other.id !== s.id && other.targetCommitmentId === s.targetCommitmentId,
        );
        for (const sib of siblings) {
          // Only add edge from earlier to later session to avoid duplicates
          if (s.id < sib.id) {
            edges.push({
              from: s.id,
              to: sib.id,
              type: 'commitment-linkage',
              label: `commitment:${s.targetCommitmentId}`,
            });
          }
        }
      }

      // 3. Specialization evolution edges
      if (s.manifest.specialization) {
        const sameSpec = sessions.filter(
          other => other.id !== s.id
            && other.manifest.specialization === s.manifest.specialization
            && (other.createdAt < s.createdAt || (other.createdAt === s.createdAt && other.id < s.id)),
        );
        // Link to the most recent predecessor with same specialization
        if (sameSpec.length > 0) {
          const predecessor = sameSpec.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
          edges.push({
            from: predecessor.id,
            to: s.id,
            type: 'specialization-evolution',
            label: s.manifest.specialization,
          });
        }
      }
    }

    // 4. Reuse edges from router enforcement history
    if (router) {
      const enforcement = router.enforcementSnapshot();
      // Reuse suggestions are encoded in enforcement records
      // (We don't have direct reuse edges yet — they'll come when enforceRouting
      // returns suggestReuseSessionId and is acted upon)
    }

    // 5. Round 20.8 G4: Intervention edges from action history
    if (interventionService) {
      for (const action of allActions) {
        // Intervention edges: operator → affected session
        if (action.executionResult?.success && action.targetId && this.sessions.has(action.targetId)) {
          edges.push({
            from: `operator:${action.operator}`,
            to: action.targetId,
            type: 'intervention',
            label: `${action.kind}: ${action.executionResult.consequenceSummary}`,
          });
        }

        // Action-consequence edges: revert/supersede/dispute → original
        if (action.relatedActionId) {
          const original = interventionService.getAction(action.relatedActionId);
          if (original && original.targetId && this.sessions.has(original.targetId)) {
            edges.push({
              from: action.id,
              to: original.targetId,
              type: 'action-consequence',
              label: `${action.kind} → ${original.kind}`,
            });
          }
        }
      }
    }

    // Stats
    const edgesByType: Record<string, number> = {};
    for (const e of edges) {
      edgesByType[e.type] = (edgesByType[e.type] ?? 0) + 1;
    }
    const maxDepth = depthMap.size > 0 ? Math.max(...depthMap.values()) : 0;

    return {
      nodes,
      edges,
      stats: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        maxDepth,
        edgesByType,
      },
      generatedAt: now,
    };
  }
}
