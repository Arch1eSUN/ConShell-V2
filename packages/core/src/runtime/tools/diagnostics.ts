/**
 * Diagnostics Tools — Round 19.8 G7
 *
 * Provides operator-facing diagnostic capabilities:
 * - doctor: synthesized health check across all truth dimensions
 * - export_posture: machine-readable JSON snapshot of all posture data
 *
 * These tools are injected at kernel boot with the PostureService reference.
 */
import type { ToolHandler } from '../tool-executor.js';
import type { AgentPostureService } from '../../api-surface/agent-posture-service.js';

/**
 * Create diagnostic tools that require runtime-injected PostureService.
 */
export function createDiagnosticsTools(postureService: { snapshot: () => ReturnType<AgentPostureService['snapshot']> }): ToolHandler[] {
  const doctorTool: ToolHandler = {
    name: 'doctor',
    description: 'Run a health check across all truth dimensions (identity, economic, lineage, collective, governance, agenda). Returns a human-readable diagnostic report with severity indicators.',
    async execute() {
      try {
        const snap = postureService.snapshot();
        const lines: string[] = [];

        lines.push(`╔═══════════════════════════════════════╗`);
        lines.push(`║  ConShell Doctor — Health Report      ║`);
        lines.push(`╚═══════════════════════════════════════╝`);
        lines.push(``);
        lines.push(`Agent:   ${snap.agentId}`);
        lines.push(`Version: ${snap.version}`);
        lines.push(`Time:    ${snap.timestamp}`);
        lines.push(`Health:  ${snap.overallHealthScore}/100 (${snap.healthVerdict})`);
        lines.push(``);

        // Identity
        const id = snap.identity;
        const idStatus = id.chainValid && !id.soulDrifted ? '✅' : '⚠️';
        lines.push(`${idStatus} Identity`);
        lines.push(`   Mode: ${id.mode} | Chain: ${id.chainValid ? 'valid' : 'BROKEN'} (${id.chainLength}) | Soul: ${id.soulDrifted ? 'DRIFTED' : 'stable'}`);

        // Economic
        const ec = snap.economic;
        const ecStatus = ec.runwayDays > 7 ? '✅' : ec.runwayDays > 1 ? '⚠️' : '🔴';
        lines.push(`${ecStatus} Economic`);
        lines.push(`   Tier: ${ec.survivalTier} | Balance: ${ec.balanceCents}¢ | Runway: ${ec.runwayDays}d | Burn: ${ec.burnRateCentsPerDay}¢/d`);

        // Collective
        const coll = snap.collective;
        const collStatus = coll.degradedPeers === 0 ? '✅' : '⚠️';
        lines.push(`${collStatus} Collective`);
        lines.push(`   Peers: ${coll.totalPeers} (${coll.trustedPeers} trusted, ${coll.degradedPeers} degraded)`);

        // Governance
        const gov = snap.governance;
        const govStatus = !gov.selfModQuarantined && gov.pendingProposals === 0 ? '✅' : '⚠️';
        lines.push(`${govStatus} Governance`);
        lines.push(`   Pending: ${gov.pendingProposals} | Verdicts: ${gov.recentVerdicts} | Quarantined: ${gov.selfModQuarantined ? 'YES' : 'no'}`);

        // Agenda
        const ag = snap.agenda;
        const agStatus = ag.blocked === 0 ? '✅' : '⚠️';
        lines.push(`${agStatus} Agenda`);
        lines.push(`   Active: ${ag.active} | Scheduled: ${ag.scheduled} | Deferred: ${ag.deferred} | Blocked: ${ag.blocked}`);
        lines.push(`   Priority: ${ag.priorityReason}`);

        lines.push(``);
        lines.push(`─── End of Report ───`);

        return lines.join('\n');
      } catch (err) {
        return `Doctor error: ${String(err)}`;
      }
    },
  };

  const exportPostureTool: ToolHandler = {
    name: 'export_posture',
    description: 'Export the current posture snapshot as machine-readable JSON. Useful for external monitoring, auditing, or feeding into dashboards.',
    async execute() {
      try {
        const snap = postureService.snapshot();
        return JSON.stringify(snap, null, 2);
      } catch (err) {
        return JSON.stringify({ error: String(err) });
      }
    },
  };

  return [doctorTool, exportPostureTool];
}
