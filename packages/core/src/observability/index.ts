/**
 * Observability — 指标 + 告警
 */

export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface MetricValue {
  name: string;
  type: MetricType;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

export interface MetricSnapshot {
  metrics: MetricValue[];
  timestamp: number;
}

export interface AlertRule {
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq';
  threshold: number;
  window: number; // seconds
}

export interface AlertEvent {
  rule: AlertRule;
  value: number;
  triggered: boolean;
  timestamp: number;
}

export class ObservabilityManager {
  private metrics = new Map<string, MetricValue>();
  private rules: AlertRule[] = [];
  private alerts: AlertEvent[] = [];

  record(name: string, value: number, type: MetricType = 'gauge', labels?: Record<string, string>): void {
    this.metrics.set(name, { name, type, value, labels, timestamp: Date.now() });
  }

  increment(name: string, delta = 1): void {
    const current = this.metrics.get(name);
    this.record(name, (current?.value ?? 0) + delta, 'counter');
  }

  snapshot(): MetricSnapshot {
    return { metrics: Array.from(this.metrics.values()), timestamp: Date.now() };
  }

  addRule(rule: AlertRule): void { this.rules.push(rule); }

  checkAlerts(): AlertEvent[] {
    const events: AlertEvent[] = [];
    for (const rule of this.rules) {
      const m = this.metrics.get(rule.metric);
      if (!m) continue;
      let triggered = false;
      if (rule.condition === 'gt' && m.value > rule.threshold) triggered = true;
      if (rule.condition === 'lt' && m.value < rule.threshold) triggered = true;
      if (rule.condition === 'eq' && m.value === rule.threshold) triggered = true;
      if (triggered) {
        const evt = { rule, value: m.value, triggered, timestamp: Date.now() };
        events.push(evt);
        this.alerts.push(evt);
      }
    }
    return events;
  }

  recentAlerts(): AlertEvent[] { return this.alerts.slice(-50); }
}
