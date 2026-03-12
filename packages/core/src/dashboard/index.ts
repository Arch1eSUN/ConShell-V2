/**
 * Dashboard — WebSocket Live Updates Module
 *
 * Provides real-time metric broadcasting to dashboard clients via
 * the existing WebSocketServer infrastructure.
 *
 * Features:
 * - System metric collection (CPU, memory, uptime)
 * - Boot progress events
 * - Plugin status events
 * - Channel activity events
 * - Task/conversation events
 * - Configurable broadcast interval
 * - Client subscription topics
 */
import type { Logger } from '../types/common.js';
import type { WebSocketServer, WSClient } from '../server/websocket.js';

// ── Types ──────────────────────────────────────────────────

export type DashboardTopic =
  | 'metrics'
  | 'boot'
  | 'plugins'
  | 'channels'
  | 'tasks'
  | 'conversations'
  | 'logs'
  | 'alerts';

export interface MetricsSnapshot {
  timestamp: string;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  connections: {
    websocket: number;
    channels: number;
  };
  plugins: {
    active: number;
    total: number;
  };
  requests: {
    total: number;
    ratePerMin: number;
  };
}

export interface DashboardEvent<T = unknown> {
  topic: DashboardTopic;
  action: string;
  data: T;
  timestamp: string;
}

export interface DashboardOptions {
  /** Metric broadcast interval in ms (default 5000) */
  metricsIntervalMs?: number;
  /** Whether to auto-start metrics broadcasting (default true) */
  autoStart?: boolean;
  /** Max events stored for late-joining clients (default 100) */
  eventBufferSize?: number;
}

// ── Dashboard ──────────────────────────────────────────────

export class Dashboard {
  private logger: Logger;
  private ws: WebSocketServer;
  private metricsTimer: ReturnType<typeof setInterval> | null = null;
  private eventBuffer: DashboardEvent[] = [];
  private opts: Required<DashboardOptions>;
  private requestCount = 0;
  private requestCountStart = Date.now();
  private subscriptions = new Map<string, Set<DashboardTopic>>(); // clientId → topics
  private collectors: Array<() => Partial<MetricsSnapshot>> = [];

  constructor(ws: WebSocketServer, logger: Logger, opts?: DashboardOptions) {
    this.ws = ws;
    this.logger = logger.child('dashboard');
    this.opts = {
      metricsIntervalMs: opts?.metricsIntervalMs ?? 5000,
      autoStart: opts?.autoStart ?? true,
      eventBufferSize: opts?.eventBufferSize ?? 100,
    };

    this.setupHandlers();
    if (this.opts.autoStart) this.startMetrics();
  }

  // ── Public API ───────────────────────────────────────────

  /** Publish an event to all subscribed clients */
  publish<T>(topic: DashboardTopic, action: string, data: T): void {
    const event: DashboardEvent<T> = {
      topic,
      action,
      data,
      timestamp: new Date().toISOString(),
    };

    // Buffer for late-joining clients
    this.eventBuffer.push(event);
    if (this.eventBuffer.length > this.opts.eventBufferSize) {
      this.eventBuffer = this.eventBuffer.slice(-this.opts.eventBufferSize);
    }

    // Broadcast to subscribed clients
    this.ws.broadcast(`dashboard:${topic}`, { action, data });
  }

  /** Register a custom metric collector */
  registerCollector(collector: () => Partial<MetricsSnapshot>): void {
    this.collectors.push(collector);
  }

  /** Track an incoming request for rate calculation */
  trackRequest(): void {
    this.requestCount++;
  }

  /** Start periodic metric broadcasts */
  startMetrics(): void {
    if (this.metricsTimer) return;

    this.metricsTimer = setInterval(() => {
      const metrics = this.collectMetrics();
      this.publish('metrics', 'snapshot', metrics);
    }, this.opts.metricsIntervalMs);

    this.logger.info('Dashboard metrics broadcasting started', {
      intervalMs: this.opts.metricsIntervalMs,
    });
  }

  /** Stop metric broadcasts */
  stopMetrics(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
  }

  /** Get current metrics without broadcasting */
  getMetrics(): MetricsSnapshot {
    return this.collectMetrics();
  }

  /** Get buffered events, optionally filtered by topic */
  getEventBuffer(topic?: DashboardTopic): DashboardEvent[] {
    if (!topic) return [...this.eventBuffer];
    return this.eventBuffer.filter(e => e.topic === topic);
  }

  /** Clean up */
  destroy(): void {
    this.stopMetrics();
    this.subscriptions.clear();
    this.eventBuffer = [];
  }

  // ── Handlers ─────────────────────────────────────────────

  private setupHandlers(): void {
    // Client subscribe to topics
    this.ws.onMessage('dashboard:subscribe', (client: WSClient, data: unknown) => {
      const payload = data as { topics?: string[] };
      if (!Array.isArray(payload?.topics)) return;

      const existing = this.subscriptions.get(client.id) ?? new Set();
      for (const t of payload.topics) {
        existing.add(t as DashboardTopic);
      }
      this.subscriptions.set(client.id, existing);

      // Send buffered events for the subscribed topics
      const buffered = this.eventBuffer.filter(e => existing.has(e.topic));
      if (buffered.length > 0) {
        this.ws.send(client.id, 'dashboard:history', { events: buffered.slice(-20) });
      }

      this.logger.debug('Client subscribed', { clientId: client.id, topics: Array.from(existing) });
    });

    // Client unsubscribe
    this.ws.onMessage('dashboard:unsubscribe', (client: WSClient, data: unknown) => {
      const payload = data as { topics?: string[] };
      if (!Array.isArray(payload?.topics)) return;

      const existing = this.subscriptions.get(client.id);
      if (!existing) return;
      for (const t of payload.topics) existing.delete(t as DashboardTopic);
    });

    // Client request current metrics
    this.ws.onMessage('dashboard:get_metrics', (client: WSClient) => {
      const metrics = this.collectMetrics();
      this.ws.send(client.id, 'dashboard:metrics', { action: 'snapshot', data: metrics });
    });
  }

  // ── Metric Collection ────────────────────────────────────

  private collectMetrics(): MetricsSnapshot {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const now = Date.now();
    const elapsedMin = Math.max((now - this.requestCountStart) / 60000, 1);

    const snapshot: MetricsSnapshot = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
        rss: mem.rss,
      },
      cpu: {
        user: cpu.user,
        system: cpu.system,
      },
      connections: {
        websocket: this.ws.connectionCount,
        channels: 0,
      },
      plugins: {
        active: 0,
        total: 0,
      },
      requests: {
        total: this.requestCount,
        ratePerMin: Math.round(this.requestCount / elapsedMin),
      },
    };

    // Merge custom collectors
    for (const collector of this.collectors) {
      try {
        const extra = collector();
        Object.assign(snapshot, extra);
      } catch { /* ignore collector errors */ }
    }

    return snapshot;
  }
}
