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
import { GovernanceInbox } from '../../governance/governance-inbox.js';
import type { CommitmentStore } from '../../agenda/commitment-store.js';
import type { SessionRegistry } from '../../orchestration/session-registry.js';

export function registerGovernanceRoutes(
  server: HttpServer,
  governance: GovernanceService,
  logger: Logger,
  commitmentStore?: CommitmentStore,
  sessionRegistry?: SessionRegistry,
): void {
  const log = logger.child('routes/governance');
  const inbox = new GovernanceInbox(governance);

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

  // ── Round 20.1: Spawn Proposal Routes ─────────────────────────────

  // ── POST /api/governance/proposals/:id/defer — Defer a proposal ──
  server.post('/api/governance/proposals/:id/defer', async (req: IncomingMessage, res: ServerResponse, body: string) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const segments = url.pathname.split('/');
      const id = segments[segments.length - 2]!;
      const { reason } = JSON.parse(body || '{}');
      const proposal = governance.deferProposal(id, reason ?? 'No reason given');
      log.info('Proposal deferred', { id });
      server.sendJson(res, 200, { proposal });
    } catch (err) {
      server.sendJson(res, 400, { error: String(err) });
    }
  });

  // ── POST /api/governance/proposals/:id/expire — Expire a proposal ──
  server.post('/api/governance/proposals/:id/expire', async (req: IncomingMessage, res: ServerResponse, body: string) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const segments = url.pathname.split('/');
      const id = segments[segments.length - 2]!;
      const { reason } = JSON.parse(body || '{}');
      const proposal = governance.expireProposal(id, reason);
      log.info('Proposal expired', { id });
      server.sendJson(res, 200, { proposal });
    } catch (err) {
      server.sendJson(res, 400, { error: String(err) });
    }
  });

  // ── GET /api/governance/spawn-outcomes — List spawn outcomes ──
  server.get('/api/governance/spawn-outcomes', async (req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const status = url.searchParams.get('status') ?? undefined;
      const outcomes = governance.listSpawnOutcomes(status ? { status: status as any } : undefined);
      server.sendJson(res, 200, { outcomes, count: outcomes.length });
    } catch (err) {
      server.sendJson(res, 500, { error: String(err) });
    }
  });

  // ── GET /api/governance/inbox — Unified operator inbox ──
  server.get('/api/governance/inbox', async (req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const category = url.searchParams.get('category') ?? undefined;
      const result = inbox.getInbox(category ? { category: category as any } : undefined);
      server.sendJson(res, 200, result);
    } catch (err) {
      server.sendJson(res, 500, { error: String(err) });
    }
  });

  // ── POST /api/governance/proposals/:id/reject — Reject a proposal ──
  server.post('/api/governance/proposals/:id/reject', async (req: IncomingMessage, res: ServerResponse, body: string) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const segments = url.pathname.split('/');
      const id = segments[segments.length - 2]!;
      const { reason } = JSON.parse(body || '{}');
      const proposal = governance.expireProposal(id, reason ?? 'Rejected by operator');
      log.info('Proposal rejected', { id });
      server.sendJson(res, 200, { proposal });
    } catch (err) {
      server.sendJson(res, 400, { error: String(err) });
    }
  });

  // ── GET /api/governance/economic-truth — Economic organism dashboard ──
  server.get('/api/governance/economic-truth', async (_req: IncomingMessage, res: ServerResponse) => {
    try {
      const inboxSummary = inbox.getInbox();
      const proposals = governance.listProposals();
      const spawnOutcomes = governance.listSpawnOutcomes?.() ?? [];

      // Round 20.3: Agenda horizon data
      const allCommitments = commitmentStore?.list() ?? [];
      const statusCounts: Record<string, number> = {};
      for (const c of allCommitments) {
        statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
      }
      const now = new Date().toISOString();
      const nextReviewable = commitmentStore?.nextReviewable(now) ?? [];

      // Round 20.4: Child runtime truth
      const childRuntime = sessionRegistry?.childRuntimeSummary() ?? null;

      server.sendJson(res, 200, {
        organism: {
          inbox: inboxSummary,
          governance: { totalProposals: proposals.length },
          spawnOutcomes: spawnOutcomes.slice(-10),
          agendaHorizon: {
            totalCommitments: allCommitments.length,
            statusCounts,
            nextReEvaluations: nextReviewable.slice(0, 5).map(c => ({
              id: c.id,
              name: c.name,
              nextReviewAt: c.nextReviewAt,
              status: c.status,
            })),
          },
          childRuntime,
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      server.sendJson(res, 500, { error: String(err) });
    }
  });

  log.info('Governance routes registered (13 endpoints)');
}
