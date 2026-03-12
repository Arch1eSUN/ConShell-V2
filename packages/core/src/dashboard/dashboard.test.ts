/**
 * Dashboard WebSocket Live Updates Tests
 *
 * Tests metric collection, event publishing, topic subscriptions,
 * event buffering, and cleanup.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Dashboard, type DashboardTopic } from '../dashboard/index.js';
import type { WebSocketServer, WSClient } from '../server/websocket.js';

function makeLogger() {
  return {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: () => makeLogger(),
  } as any;
}

function makeWS(): WebSocketServer & { broadcasts: any[]; sends: any[] } {
  const handlers = new Map<string, Function>();
  const sends: any[] = [];
  const broadcasts: any[] = [];

  return {
    broadcasts,
    sends,
    onMessage: vi.fn((type: string, handler: Function) => handlers.set(type, handler)),
    broadcast: vi.fn((type: string, data: unknown) => broadcasts.push({ type, data })),
    send: vi.fn((clientId: string, type: string, data: unknown) => sends.push({ clientId, type, data })),
    get connectionCount() { return 3; },
    // Simulate triggering a handler
    _trigger(type: string, client: WSClient, data: unknown) {
      const h = handlers.get(type);
      if (h) h(client, data);
    },
  } as any;
}

describe('Dashboard', () => {
  let ws: ReturnType<typeof makeWS>;
  let dashboard: Dashboard;

  beforeEach(() => {
    vi.useFakeTimers();
    ws = makeWS();
    dashboard = new Dashboard(ws, makeLogger(), { autoStart: false, metricsIntervalMs: 1000 });
  });

  afterEach(() => {
    dashboard.destroy();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should register WS message handlers', () => {
      expect(ws.onMessage).toHaveBeenCalledWith('dashboard:subscribe', expect.any(Function));
      expect(ws.onMessage).toHaveBeenCalledWith('dashboard:unsubscribe', expect.any(Function));
      expect(ws.onMessage).toHaveBeenCalledWith('dashboard:get_metrics', expect.any(Function));
    });

    it('should not auto-start when autoStart is false', () => {
      expect(ws.broadcast).not.toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    it('should broadcast events to all clients', () => {
      dashboard.publish('plugins', 'loaded', { name: 'test-plugin' });

      expect(ws.broadcast).toHaveBeenCalledWith(
        'dashboard:plugins',
        { action: 'loaded', data: { name: 'test-plugin' } },
      );
    });

    it('should buffer events', () => {
      dashboard.publish('tasks', 'created', { id: 1 });
      dashboard.publish('tasks', 'completed', { id: 1 });

      const buffer = dashboard.getEventBuffer('tasks');
      expect(buffer).toHaveLength(2);
      expect(buffer[0].action).toBe('created');
      expect(buffer[1].action).toBe('completed');
    });

    it('should cap buffer at eventBufferSize', () => {
      const small = new Dashboard(ws, makeLogger(), { autoStart: false, eventBufferSize: 3 });
      for (let i = 0; i < 10; i++) {
        small.publish('logs', `event-${i}`, { i });
      }
      expect(small.getEventBuffer().length).toBeLessThanOrEqual(3);
      small.destroy();
    });
  });

  describe('getMetrics', () => {
    it('should return system metrics', () => {
      const metrics = dashboard.getMetrics();
      expect(metrics.timestamp).toBeDefined();
      expect(metrics.uptime).toBeGreaterThan(0);
      expect(metrics.memory.rss).toBeGreaterThan(0);
      expect(metrics.memory.heapUsed).toBeGreaterThan(0);
      expect(metrics.connections.websocket).toBe(3); // from mock
    });

    it('should track request rates', () => {
      dashboard.trackRequest();
      dashboard.trackRequest();
      dashboard.trackRequest();
      const metrics = dashboard.getMetrics();
      expect(metrics.requests.total).toBe(3);
    });
  });

  describe('registerCollector', () => {
    it('should merge custom collector data', () => {
      dashboard.registerCollector(() => ({
        plugins: { active: 5, total: 8 },
      }));

      const metrics = dashboard.getMetrics();
      expect(metrics.plugins.active).toBe(5);
      expect(metrics.plugins.total).toBe(8);
    });

    it('should ignore collector errors', () => {
      dashboard.registerCollector(() => { throw new Error('boom'); });
      const metrics = dashboard.getMetrics();
      expect(metrics.timestamp).toBeDefined(); // still works
    });
  });

  describe('startMetrics', () => {
    it('should broadcast metrics on interval', () => {
      dashboard.startMetrics();
      vi.advanceTimersByTime(3000);
      // Should have broadcast 3 times (at 1s, 2s, 3s)
      const metricBroadcasts = ws.broadcasts.filter(b => b.type === 'dashboard:metrics');
      expect(metricBroadcasts.length).toBe(3);
    });

    it('should stop broadcasting when stopMetrics called', () => {
      dashboard.startMetrics();
      vi.advanceTimersByTime(2000);
      dashboard.stopMetrics();
      vi.advanceTimersByTime(3000);
      const metricBroadcasts = ws.broadcasts.filter(b => b.type === 'dashboard:metrics');
      expect(metricBroadcasts.length).toBe(2); // only first 2
    });
  });

  describe('client subscriptions', () => {
    it('should handle subscribe message', () => {
      const client: WSClient = { id: 'c1', socket: {} as any, connectedAt: new Date().toISOString() };
      (ws as any)._trigger('dashboard:subscribe', client, { topics: ['metrics', 'tasks'] });
      // Should respond with history
      // No error means it handled correctly
    });

    it('should handle get_metrics request', () => {
      const client: WSClient = { id: 'c2', socket: {} as any, connectedAt: new Date().toISOString() };
      (ws as any)._trigger('dashboard:get_metrics', client, {});
      expect(ws.send).toHaveBeenCalledWith('c2', 'dashboard:metrics', expect.objectContaining({
        action: 'snapshot',
      }));
    });
  });

  describe('getEventBuffer', () => {
    it('should return all events when no topic filter', () => {
      dashboard.publish('tasks', 'a', {});
      dashboard.publish('plugins', 'b', {});
      expect(dashboard.getEventBuffer()).toHaveLength(2);
    });

    it('should filter by topic', () => {
      dashboard.publish('tasks', 'a', {});
      dashboard.publish('plugins', 'b', {});
      dashboard.publish('tasks', 'c', {});
      expect(dashboard.getEventBuffer('tasks')).toHaveLength(2);
      expect(dashboard.getEventBuffer('plugins')).toHaveLength(1);
    });
  });

  describe('destroy', () => {
    it('should stop metrics and clear state', () => {
      dashboard.startMetrics();
      dashboard.publish('logs', 'test', {});
      dashboard.destroy();
      expect(dashboard.getEventBuffer()).toHaveLength(0);
    });
  });
});
