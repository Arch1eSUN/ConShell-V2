/**
 * System Summary Route — Round 19.4
 *
 * Aggregated endpoint for UI/TUI first-screen consumption.
 * Returns a unified system snapshot so frontends don't need to
 * stitch together 10+ separate API calls.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpServer } from '../http.js';
import type { AgentStateMachine } from '../../runtime/state-machine.js';
import type { AgentPostureService } from '../../api-surface/agent-posture-service.js';
import type { Logger } from '../../types/common.js';
import { VERSION } from '../../index.js';

export interface SystemSummaryDeps {
  stateMachine: AgentStateMachine;
  postureService?: AgentPostureService;
  economicService?: { getProjection(): any; getCurrentTier(): string };
  collectiveService?: { diagnostics(): any };
  governanceService?: { diagnostics(): any };
}

export function registerSystemSummaryRoutes(
  server: HttpServer,
  deps: SystemSummaryDeps,
  logger: Logger,
): void {
  const log = logger.child('routes/system-summary');

  // GET /api/system/summary — Aggregated system snapshot
  server.get('/api/system/summary', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const sm = deps.stateMachine;

      // Agent state
      const agent = {
        state: sm.state,
        alive: sm.isAlive,
        ready: sm.isReady,
        uptime: process.uptime(),
      };

      // Posture (full snapshot if available)
      let posture = null;
      if (deps.postureService) {
        try {
          posture = deps.postureService.snapshot();
        } catch {
          posture = { error: 'posture_unavailable' };
        }
      }

      // Economic summary
      let economic = null;
      if (deps.economicService) {
        try {
          const proj = deps.economicService.getProjection();
          economic = {
            survivalTier: String(proj.survivalTier),
            balanceCents: proj.currentBalanceCents,
            burnRateCentsPerDay: proj.burnRateCentsPerDay,
            runwayDays: proj.runwayDays,
            isSelfSustaining: proj.isSelfSustaining,
          };
        } catch {
          economic = { error: 'economic_unavailable' };
        }
      }

      // Collective summary
      let collective = null;
      if (deps.collectiveService) {
        try {
          const diag = deps.collectiveService.diagnostics();
          collective = {
            totalPeers: diag.totalPeers,
            activeChildren: diag.activeChildren,
            degradedPeerCount: diag.degradedPeerCount,
            delegationSuccessRate: diag.delegationSuccessRate,
          };
        } catch {
          collective = { error: 'collective_unavailable' };
        }
      }

      // Governance summary
      let governance = null;
      if (deps.governanceService) {
        try {
          const diag = deps.governanceService.diagnostics();
          governance = {
            totalProposals: diag.totalProposals,
            pendingProposals: diag.proposalsByStatus?.['pending'] ?? 0,
            approvalRate: diag.approvalRate,
          };
        } catch {
          governance = { error: 'governance_unavailable' };
        }
      }

      // Agenda summary (Round 19.8 — canonical from posture)
      let agenda = null;
      if (deps.postureService) {
        try {
          const snap = deps.postureService.snapshot();
          agenda = snap.agenda;
        } catch {
          agenda = { error: 'agenda_unavailable' };
        }
      }

      server.sendJson(res, 200, {
        version: VERSION,
        timestamp: new Date().toISOString(),
        agent,
        posture,
        economic,
        collective,
        governance,
        agenda,
      });
    } catch (err) {
      log.error('system summary error', { error: String(err) });
      server.sendJson(res, 500, { error: 'internal_error' });
    }
  });
}
