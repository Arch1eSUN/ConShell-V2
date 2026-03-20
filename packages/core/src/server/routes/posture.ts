/**
 * Posture API Routes — Round 19.3
 *
 * REST endpoints for the externalized truth surface (G6 closure).
 * 3 endpoints: snapshot, history, health.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpServer } from '../http.js';
import type { AgentPostureService } from '../../api-surface/agent-posture-service.js';
import type { Logger } from '../../types/common.js';

export function registerPostureRoutes(
  server: HttpServer,
  posture: AgentPostureService,
  logger: Logger,
): void {
  const log = logger.child('routes/posture');

  // ── GET /api/posture — Full posture snapshot ──
  server.get('/api/posture', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const snapshot = posture.snapshot();
      server.sendJson(res, 200, snapshot);
    } catch (err) {
      log.error('Posture snapshot failed', { error: String(err) });
      server.sendJson(res, 500, { error: String(err) });
    }
  });

  // ── GET /api/posture/history — Trend data ──
  server.get('/api/posture/history', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const hist = posture.history();
      server.sendJson(res, 200, {
        entries: hist,
        count: hist.length,
      });
    } catch (err) {
      log.error('Posture history failed', { error: String(err) });
      server.sendJson(res, 500, { error: String(err) });
    }
  });

  // ── GET /api/posture/health — Quick health verdict ──
  server.get('/api/posture/health', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const latest = posture.latest();
      if (!latest) {
        // No snapshot yet — take one
        const snapshot = posture.snapshot();
        server.sendJson(res, 200, {
          healthScore: snapshot.overallHealthScore,
          verdict: snapshot.healthVerdict,
          timestamp: snapshot.timestamp,
        });
        return;
      }
      server.sendJson(res, 200, {
        healthScore: latest.overallHealthScore,
        verdict: latest.healthVerdict,
        timestamp: latest.timestamp,
      });
    } catch (err) {
      log.error('Posture health check failed', { error: String(err) });
      server.sendJson(res, 500, { error: String(err) });
    }
  });

  // ── GET /api/posture/doctor — Human-readable diagnostic report (Round 19.9 G4) ──
  server.get('/api/posture/doctor', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const snap = posture.snapshot();
      const lines: string[] = [];

      lines.push('╔═══════════════════════════════════════╗');
      lines.push('║  ConShell Doctor — Health Report      ║');
      lines.push('╚═══════════════════════════════════════╝');
      lines.push('');
      lines.push(`Agent:   ${snap.agentId}`);
      lines.push(`Version: ${snap.version}`);
      lines.push(`Time:    ${snap.timestamp}`);
      lines.push(`Health:  ${snap.overallHealthScore}/100 (${snap.healthVerdict})`);
      lines.push('');

      const id = snap.identity;
      const idS = id.chainValid && !id.soulDrifted ? '✅' : '⚠️';
      lines.push(`${idS} Identity — Mode: ${id.mode} | Chain: ${id.chainValid ? 'valid' : 'BROKEN'} (${id.chainLength}) | Soul: ${id.soulDrifted ? 'DRIFTED' : 'stable'}`);

      const ec = snap.economic;
      const ecS = ec.runwayDays > 7 ? '✅' : ec.runwayDays > 1 ? '⚠️' : '🔴';
      lines.push(`${ecS} Economic — Tier: ${ec.survivalTier} | Balance: ${ec.balanceCents}¢ | Runway: ${ec.runwayDays}d`);

      const coll = snap.collective;
      const coS = coll.degradedPeers === 0 ? '✅' : '⚠️';
      lines.push(`${coS} Collective — Peers: ${coll.totalPeers} (${coll.trustedPeers} trusted, ${coll.degradedPeers} degraded)`);

      const gov = snap.governance;
      const goS = !gov.selfModQuarantined ? '✅' : '⚠️';
      lines.push(`${goS} Governance — Pending: ${gov.pendingProposals} | Quarantined: ${gov.selfModQuarantined ? 'YES' : 'no'}`);

      const ag = snap.agenda;
      const agS = ag.blocked === 0 ? '✅' : '⚠️';
      lines.push(`${agS} Agenda — Active: ${ag.active} | Scheduled: ${ag.scheduled} | Blocked: ${ag.blocked} | Priority: ${ag.priorityReason}`);

      server.sendJson(res, 200, { report: lines.join('\n'), snapshot: snap });
    } catch (err) {
      log.error('Doctor report failed', { error: String(err) });
      server.sendJson(res, 500, { error: String(err) });
    }
  });

  // ── GET /api/posture/export — Machine-readable JSON export (Round 19.9 G4) ──
  server.get('/api/posture/export', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const snap = posture.snapshot();
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="posture-snapshot.json"',
      });
      res.end(JSON.stringify(snap, null, 2));
    } catch (err) {
      log.error('Posture export failed', { error: String(err) });
      server.sendJson(res, 500, { error: String(err) });
    }
  });

  log.info('Posture routes registered (5 endpoints: /api/posture, /api/posture/history, /api/posture/health, /api/posture/doctor, /api/posture/export)');
}
