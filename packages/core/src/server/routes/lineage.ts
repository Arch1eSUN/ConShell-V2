/**
 * Lineage Routes — Round 16.5
 *
 * Collective control surface for parent-child lineage.
 * Provides REST API to query children, recall, terminate, and view stats.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpServer } from '../http.js';
import type { LineageService } from '../../lineage/index.js';
import type { Logger } from '../../types/common.js';
import type { ChildRuntimeStatus, RecallPolicy } from '../../lineage/index.js';

export function registerLineageRoutes(
  server: HttpServer,
  lineage: LineageService,
  logger: Logger,
): void {
  const log = logger.child('routes/lineage');

  // ── GET /api/lineage/children — List children ──
  server.get('/api/lineage/children', async (req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const status = url.searchParams.get('status') as ChildRuntimeStatus | null;
      const parentId = url.searchParams.get('parentId') ?? undefined;
      const children = lineage.listChildren({
        status: status ?? undefined,
        parentId,
      });
      server.sendJson(res, 200, { children, count: children.length });
    } catch (err) {
      server.sendJson(res, 500, { error: String(err) });
    }
  });

  // ── GET /api/lineage/children/:id — Get child detail ──
  server.get('/api/lineage/children/:id', async (req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const id = url.pathname.split('/').pop()!;
      const record = lineage.getRecord(id);
      if (!record) {
        server.sendJson(res, 404, { error: `Lineage record not found: ${id}` });
        return;
      }
      const identity = lineage.childIdentitySummary(id);
      server.sendJson(res, 200, { record, identity });
    } catch (err) {
      server.sendJson(res, 500, { error: String(err) });
    }
  });

  // ── POST /api/lineage/children/:id/recall — Recall a child ──
  server.post('/api/lineage/children/:id/recall', async (req: IncomingMessage, res: ServerResponse, body: string) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const segments = url.pathname.split('/');
      const id = segments[segments.length - 2]!;
      const input = body ? JSON.parse(body) : {};
      const policy: RecallPolicy = {
        reason: input.reason ?? 'Operator recall',
        actor: input.actor ?? 'operator',
        governanceRequired: input.governanceRequired ?? false,
        cleanupFunding: input.cleanupFunding ?? true,
        cascadeToChildren: input.cascadeToChildren ?? true,
      };
      const receipt = await lineage.recallChild(id, policy);
      log.info('Child recalled via API', { id, reason: policy.reason });
      server.sendJson(res, 200, { receipt });
    } catch (err) {
      log.error('Recall failed', { error: String(err) });
      server.sendJson(res, 400, { error: String(err) });
    }
  });

  // ── POST /api/lineage/children/:id/terminate — Terminate a child ──
  server.post('/api/lineage/children/:id/terminate', async (req: IncomingMessage, res: ServerResponse, body: string) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const segments = url.pathname.split('/');
      const id = segments[segments.length - 2]!;
      const input = body ? JSON.parse(body) : {};
      const receipt = await lineage.terminateChild(
        id,
        input.reason ?? 'Operator termination',
        input.actor ?? 'operator',
      );
      log.info('Child terminated via API', { id });
      server.sendJson(res, 200, { receipt });
    } catch (err) {
      log.error('Terminate failed', { error: String(err) });
      server.sendJson(res, 400, { error: String(err) });
    }
  });

  // ── GET /api/lineage/stats — Lineage diagnostics ──
  server.get('/api/lineage/stats', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const stats = lineage.stats();
      server.sendJson(res, 200, stats);
    } catch (err) {
      server.sendJson(res, 500, { error: String(err) });
    }
  });

  log.info('Lineage routes registered (5 endpoints)');
}
