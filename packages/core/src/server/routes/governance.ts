/**
 * Governance Routes — Round 16.4
 *
 * REST API control surface for the unified governance workflow.
 * All high-risk action proposals are submitted, queried, and managed here.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpServer } from '../http.js';
import type { GovernanceService } from '../../governance/governance-service.js';
import type { Logger } from '../../types/common.js';

export function registerGovernanceRoutes(
  server: HttpServer,
  governance: GovernanceService,
  logger: Logger,
): void {
  const log = logger.child('routes/governance');

  // ── POST /api/governance/proposals — Create a new governance proposal ──
  server.post('/api/governance/proposals', async (_req: IncomingMessage, res: ServerResponse, body: string) => {
    try {
      const input = JSON.parse(body);
      if (!input.actionKind || !input.target || !input.justification) {
        server.sendJson(res, 400, { error: 'Missing required fields: actionKind, target, justification' });
        return;
      }
      const proposal = governance.propose(input);
      // Auto-evaluate immediately
      const decision = governance.evaluate(proposal.id);
      log.info('Proposal created + evaluated', { id: proposal.id, decision });
      server.sendJson(res, 201, { proposal: governance.getProposal(proposal.id), decision });
    } catch (err) {
      log.error('Failed to create proposal', { error: String(err) });
      server.sendJson(res, 500, { error: String(err) });
    }
  });

  // ── GET /api/governance/proposals — List proposals ──
  server.get('/api/governance/proposals', async (req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const status = url.searchParams.get('status') ?? undefined;
      const actionKind = url.searchParams.get('actionKind') ?? undefined;
      const proposals = governance.listProposals({
        status: status as any,
        actionKind: actionKind as any,
      });
      server.sendJson(res, 200, { proposals, count: proposals.length });
    } catch (err) {
      server.sendJson(res, 500, { error: String(err) });
    }
  });

  // ── GET /api/governance/proposals/:id — Get a single proposal ──
  server.get('/api/governance/proposals/:id', async (req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const id = url.pathname.split('/').pop()!;
      const proposal = governance.getProposal(id);
      if (!proposal) {
        server.sendJson(res, 404, { error: `Proposal not found: ${id}` });
        return;
      }
      const receipts = governance.getReceipts(id);
      server.sendJson(res, 200, { proposal, receipts });
    } catch (err) {
      server.sendJson(res, 500, { error: String(err) });
    }
  });

  // ── GET /api/governance/proposals/:id/whatif — What-If Projection ──
  server.get('/api/governance/proposals/:id/whatif', async (req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const segments = url.pathname.split('/');
      const id = segments[segments.length - 2]!; // proposals/:id/whatif
      const whatIf = governance.whatIf(id);
      server.sendJson(res, 200, { projection: whatIf });
    } catch (err) {
      server.sendJson(res, 500, { error: String(err) });
    }
  });

  // ── POST /api/governance/proposals/:id/apply — Apply an approved proposal ──
  server.post('/api/governance/proposals/:id/apply', async (req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const segments = url.pathname.split('/');
      const id = segments[segments.length - 2]!;
      const receipt = await governance.apply(id);
      log.info('Proposal applied', { id, result: receipt.result });
      server.sendJson(res, 200, { receipt });
    } catch (err) {
      log.error('Apply failed', { error: String(err) });
      server.sendJson(res, 400, { error: String(err) });
    }
  });

  // ── POST /api/governance/proposals/:id/approve — Force-approve an escalated proposal ──
  server.post('/api/governance/proposals/:id/approve', async (req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const segments = url.pathname.split('/');
      const id = segments[segments.length - 2]!;
      const decision = governance.forceApprove(id);
      log.info('Proposal force-approved', { id });
      server.sendJson(res, 200, { proposal: governance.getProposal(id), decision });
    } catch (err) {
      server.sendJson(res, 400, { error: String(err) });
    }
  });

  // ── POST /api/governance/proposals/:id/rollback — Rollback an applied proposal ──
  server.post('/api/governance/proposals/:id/rollback', async (req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const segments = url.pathname.split('/');
      const id = segments[segments.length - 2]!;
      const receipt = await governance.rollback(id);
      log.info('Proposal rolled back', { id, result: receipt.result });
      server.sendJson(res, 200, { receipt });
    } catch (err) {
      server.sendJson(res, 400, { error: String(err) });
    }
  });

  // ── GET /api/governance/stats — Governance diagnostics & metrics ──
  server.get('/api/governance/stats', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const diagnostics = governance.diagnostics();
      server.sendJson(res, 200, diagnostics);
    } catch (err) {
      server.sendJson(res, 500, { error: String(err) });
    }
  });

  log.info('Governance routes registered (7 endpoints)');
}
