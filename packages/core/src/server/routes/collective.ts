/**
 * Collective API Routes — Round 16.6 → 16.7
 *
 * REST endpoints for collective runtime control surface.
 * 12 endpoints: 7 original + 5 new (discovery, reputation, delegate).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpServer } from '../http.js';
import type { CollectiveService } from '../../collective/index.js';
import type { Logger } from '../../types/common.js';
import type { PeerStatus, PeerKind } from '../../collective/index.js';
import type { PeerDiscoveryService } from '../../collective/discovery-service.js';
import type { ReputationService } from '../../collective/reputation-service.js';
import type { PeerSelector } from '../../collective/peer-selector.js';

export interface CollectiveRouteDeps {
  collective: CollectiveService;
  discovery?: PeerDiscoveryService;
  reputation?: ReputationService;
  selector?: PeerSelector;
}

export function registerCollectiveRoutes(
  server: HttpServer,
  deps: CollectiveRouteDeps,
  logger: Logger,
): void {
  const log = logger.child('routes/collective');
  const { collective, discovery, reputation, selector } = deps;

  // ── GET /api/collective/peers — List all peers ──
  server.get('/api/collective/peers', async (req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const status = url.searchParams.get('status') as PeerStatus | null;
      const kind = url.searchParams.get('kind') as PeerKind | null;
      const peers = collective.listPeers({
        status: status ?? undefined,
        kind: kind ?? undefined,
      });
      server.sendJson(res, 200, { peers, count: peers.length });
    } catch (err) {
      server.sendJson(res, 500, { error: String(err) });
    }
  });

  // ── GET /api/collective/peers/:id — Get single peer ──
  server.get('/api/collective/peers/:id', async (req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const id = url.pathname.split('/').pop()!;
      const peer = collective.getPeer(id);
      if (!peer) {
        server.sendJson(res, 404, { error: `Peer not found: ${id}` });
        return;
      }
      server.sendJson(res, 200, { peer });
    } catch (err) {
      server.sendJson(res, 500, { error: String(err) });
    }
  });

  // ── POST /api/collective/peers — Register external peer ──
  server.post('/api/collective/peers', async (_req: IncomingMessage, res: ServerResponse, body: string) => {
    try {
      const input = body ? JSON.parse(body) : {};
      const peer = collective.registerPeer({
        agentId: input.agentId,
        name: input.name,
        kind: input.kind ?? 'external',
        source: input.source ?? 'manual',
        capabilities: input.capabilities,
        endpoint: input.endpoint,
        fingerprint: input.fingerprint,
      });
      server.sendJson(res, 201, { peer });
    } catch (err) {
      log.error('Failed to register peer', { error: String(err) });
      server.sendJson(res, 400, { error: String(err) });
    }
  });

  // ── GET /api/collective/topology — Topology view ──
  server.get('/api/collective/topology', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const topo = collective.topology();
      server.sendJson(res, 200, topo);
    } catch (err) {
      server.sendJson(res, 500, { error: String(err) });
    }
  });

  // ── GET /api/collective/stats — Diagnostics ──
  server.get('/api/collective/stats', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      const diag = collective.diagnostics();
      server.sendJson(res, 200, diag);
    } catch (err) {
      server.sendJson(res, 500, { error: String(err) });
    }
  });

  // ── POST /api/collective/peers/:id/quarantine — Quarantine peer ──
  server.post('/api/collective/peers/:id/quarantine', async (req: IncomingMessage, res: ServerResponse, body: string) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const segments = url.pathname.split('/');
      const id = segments[segments.length - 2]!;
      const input = body ? JSON.parse(body) : {};
      collective.quarantinePeer(id, input.reason ?? 'Manual quarantine');
      const peer = collective.getPeer(id);
      server.sendJson(res, 200, { peer });
    } catch (err) {
      log.error('Failed to quarantine peer', { error: String(err) });
      server.sendJson(res, 400, { error: String(err) });
    }
  });

  // ── POST /api/collective/peers/:id/revoke — Revoke peer ──
  server.post('/api/collective/peers/:id/revoke', async (req: IncomingMessage, res: ServerResponse, body: string) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const segments = url.pathname.split('/');
      const id = segments[segments.length - 2]!;
      const input = body ? JSON.parse(body) : {};
      collective.revokePeer(id, input.reason ?? 'Manual revocation');
      const peer = collective.getPeer(id);
      server.sendJson(res, 200, { peer });
    } catch (err) {
      log.error('Failed to revoke peer', { error: String(err) });
      server.sendJson(res, 400, { error: String(err) });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // ROUND 16.7 — NEW ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════

  // ── GET /api/collective/reputation/:peerId — Peer reputation ──
  if (reputation) {
    server.get('/api/collective/reputation/:peerId', async (req: IncomingMessage, res: ServerResponse, _body: string) => {
      try {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        const peerId = url.pathname.split('/').pop()!;
        // Round 16.8: return 404 for unknown peers
        const peer = collective.getPeer(peerId);
        if (!peer) {
          server.sendJson(res, 404, { error: `Peer not found: ${peerId}` });
          return;
        }
        const rep = reputation.getReputation(peerId);
        server.sendJson(res, 200, { reputation: rep });
      } catch (err) {
        server.sendJson(res, 500, { error: String(err) });
      }
    });
  }

  // ── GET /api/collective/discovery/stats — Discovery stats ──
  if (discovery) {
    server.get('/api/collective/discovery/stats', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
      try {
        const stats = discovery.stats();
        server.sendJson(res, 200, stats);
      } catch (err) {
        server.sendJson(res, 500, { error: String(err) });
      }
    });
  }

  // ── POST /api/collective/discovery — Manual discovery ingest ──
  if (discovery) {
    server.post('/api/collective/discovery', async (_req: IncomingMessage, res: ServerResponse, body: string) => {
      try {
        const input = body ? JSON.parse(body) : {};
        const event = discovery.discoverManual({
          agentId: input.agentId,
          name: input.name,
          endpoint: input.endpoint,
          fingerprint: input.fingerprint,
          capabilities: input.capabilities,
          credibilityHint: input.credibilityHint,
        });
        server.sendJson(res, 201, { event });
      } catch (err) {
        log.error('Discovery ingest failed', { error: String(err) });
        server.sendJson(res, 400, { error: String(err) });
      }
    });
  }

  // ── POST /api/collective/delegate — Select peer + delegate ──
  if (selector) {
    server.post('/api/collective/delegate', async (_req: IncomingMessage, res: ServerResponse, body: string) => {
      try {
        const input = body ? JSON.parse(body) : {};
        const best = selector.selectBest({
          requiredCapabilities: input.requiredCapabilities,
          minTrustTier: input.minTrustTier,
          minReputationTier: input.minReputationTier,
          excludePeerIds: input.excludePeerIds,
          preferKind: input.preferKind,
        });

        if (!best) {
          server.sendJson(res, 404, { error: 'No eligible peer found' });
          return;
        }

        const receipt = collective.delegateTask(
          best.peer.id,
          input.taskDescription ?? 'API-delegated task',
          input.commitmentId,
        );

        server.sendJson(res, 200, {
          receipt,
          selectedPeer: {
            id: best.peer.id,
            name: best.peer.name,
            score: best.score,
            reasons: best.selectionReasons,
          },
        });
      } catch (err) {
        log.error('Delegation failed', { error: String(err) });
        server.sendJson(res, 400, { error: String(err) });
      }
    });
  }

  // ── GET /api/collective/selector/preview — Preview selection ──
  if (selector) {
    server.get('/api/collective/selector/preview', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
      try {
        const result = selector.select({});
        server.sendJson(res, 200, {
          candidates: result.candidates.map(c => ({
            peerId: c.peer.id,
            name: c.peer.name,
            score: c.score,
            trustScore: c.trustScore,
            reputationScore: c.reputationScore,
            capabilityScore: c.capabilityScore,
            reasons: c.selectionReasons,
          })),
          totalConsidered: result.totalConsidered,
          excludedCount: result.excluded.length,
        });
      } catch (err) {
        server.sendJson(res, 500, { error: String(err) });
      }
    });
  }

  const newEndpoints = [discovery && 2, reputation && 1, selector && 2].filter(Boolean);
  const totalNew = (newEndpoints as number[]).reduce((a, b) => a + b, 0);
  log.info(`Collective routes registered (7 base + ${totalNew} new = ${7 + totalNew} endpoints)`);
}
