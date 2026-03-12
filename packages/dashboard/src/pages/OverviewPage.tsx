/**
 * OverviewPage — Agent概览仪表盘
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface StatCard {
  label: string;
  value: string;
  icon: string;
  color: string;
}

export function OverviewPage() {
  const [health, setHealth] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.health(),
      api.getMetrics(),
    ]).then(([h, m]) => {
      if (h.status === 'fulfilled') setHealth(h.value);
      if (m.status === 'fulfilled') setMetrics(m.value);
      setLoading(false);
    });
  }, []);

  const cards: StatCard[] = [
    { label: 'Status', value: health?.status ?? '—', icon: '🟢', color: '#4ade80' },
    { label: 'Turns', value: String(metrics?.totalTurns ?? 0), icon: '💬', color: '#818cf8' },
    { label: 'Cost Today', value: `${(metrics?.dailySpentCents ?? 0) / 100}$`, icon: '💰', color: '#fbbf24' },
    { label: 'Budget Left', value: `${((metrics?.dailyBudgetCents ?? 0) - (metrics?.dailySpentCents ?? 0)) / 100}$`, icon: '📊', color: '#34d399' },
    { label: 'Memory', value: String(metrics?.memoryCount ?? 0), icon: '🧠', color: '#f472b6' },
    { label: 'Tools Used', value: String(metrics?.toolCallCount ?? 0), icon: '⚡', color: '#60a5fa' },
  ];

  return (
    <div>
      <h1 style={s.title}>Dashboard</h1>
      <p style={s.subtitle}>
        Agent: <strong>{health?.agent ?? 'ConShell'}</strong> · Uptime: {health?.uptime ? `${Math.floor(health.uptime / 60)}m` : '—'}
      </p>

      <div style={s.grid}>
        {cards.map(card => (
          <div key={card.label} style={s.card}>
            <div style={s.cardIcon}>{card.icon}</div>
            <div style={s.cardValue}>{loading ? '…' : card.value}</div>
            <div style={s.cardLabel}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={s.section}>
        <h2 style={s.sectionTitle}>Quick Actions</h2>
        <div style={s.actions}>
          <button style={s.action}>💬 New Conversation</button>
          <button style={s.action}>🩺 Health Check</button>
          <button style={s.action}>📊 View Metrics</button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  title: { fontSize: 28, fontWeight: 700, margin: '0 0 8px', color: '#f4f4f5' },
  subtitle: { fontSize: 14, color: '#71717a', margin: '0 0 32px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 40 },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #1e1e2e',
    borderRadius: 12,
    padding: '20px 16px',
    textAlign: 'center' as const,
  },
  cardIcon: { fontSize: 24, marginBottom: 8 },
  cardValue: { fontSize: 24, fontWeight: 700, color: '#f4f4f5' },
  cardLabel: { fontSize: 13, color: '#71717a', marginTop: 4 },
  section: { marginTop: 32 },
  sectionTitle: { fontSize: 18, fontWeight: 600, marginBottom: 16 },
  actions: { display: 'flex', gap: 12, flexWrap: 'wrap' as const },
  action: {
    padding: '10px 20px',
    borderRadius: 8,
    background: 'rgba(108, 92, 231, 0.15)',
    border: '1px solid rgba(108, 92, 231, 0.3)',
    color: '#a78bfa',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  },
};
