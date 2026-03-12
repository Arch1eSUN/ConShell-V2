/**
 * MetricsPage — 推理成本+使用量
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';

export function MetricsPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const data = await api.getMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load metrics:', err);
    }
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const budgetPct = metrics
    ? Math.min(100, ((metrics.dailySpentCents / Math.max(1, metrics.dailyBudgetCents)) * 100))
    : 0;

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Metrics</h1>
        <button style={s.refreshBtn} onClick={load} disabled={refreshing}>
          {refreshing ? '↻' : '🔄'} Refresh
        </button>
      </div>

      {!metrics ? (
        <div style={s.loading}>Loading metrics…</div>
      ) : (
        <>
          {/* Budget bar */}
          <div style={s.budgetCard}>
            <div style={s.budgetHeader}>
              <span>Daily Budget</span>
              <span style={s.budgetAmount}>${(metrics.dailySpentCents / 100).toFixed(2)} / ${(metrics.dailyBudgetCents / 100).toFixed(2)}</span>
            </div>
            <div style={s.barBg}>
              <div style={{
                ...s.barFill,
                width: `${budgetPct}%`,
                background: budgetPct > 80 ? '#ef4444' : budgetPct > 50 ? '#f59e0b' : '#22c55e',
              }} />
            </div>
            <div style={s.budgetPct}>{budgetPct.toFixed(0)}% used</div>
          </div>

          {/* Stats grid */}
          <div style={s.grid}>
            <MetricCard icon="💬" label="Total Turns" value={metrics.totalTurns} />
            <MetricCard icon="💰" label="Total Spent" value={`$${(metrics.totalSpentCents / 100).toFixed(2)}`} />
            <MetricCard icon="🧠" label="Memories" value={metrics.memoryCount} />
            <MetricCard icon="⚡" label="Tool Calls" value={metrics.toolCallCount} />
          </div>

          {/* Cost breakdown */}
          {metrics.costBreakdown && (
            <div style={s.section}>
              <h2 style={s.sectionTitle}>Cost Breakdown by Provider</h2>
              <div style={s.table}>
                <div style={s.tableHeader}>
                  <span>Provider</span><span>Requests</span><span>Cost</span>
                </div>
                {Object.entries(metrics.costBreakdown as Record<string, { requests: number; costCents: number }>).map(([name, data]) => (
                  <div key={name} style={s.tableRow}>
                    <span style={s.providerName}>{name}</span>
                    <span>{data.requests}</span>
                    <span>${(data.costCents / 100).toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: string; label: string; value: any }) {
  return (
    <div style={s.card}>
      <div style={{ fontSize: 24 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#f4f4f5' }}>{value}</div>
      <div style={{ fontSize: 13, color: '#71717a', marginTop: 4 }}>{label}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 28, fontWeight: 700, color: '#f4f4f5', margin: 0 },
  refreshBtn: {
    padding: '8px 16px', borderRadius: 8, border: '1px solid #27272a',
    background: 'transparent', color: '#a1a1aa', cursor: 'pointer', fontSize: 13,
  },
  loading: { color: '#71717a', padding: 32 },
  budgetCard: { padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid #1e1e2e', marginBottom: 24 },
  budgetHeader: { display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#a1a1aa', marginBottom: 12 },
  budgetAmount: { fontWeight: 600, color: '#f4f4f5' },
  barBg: { height: 8, background: '#27272a', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, transition: 'width 0.5s ease' },
  budgetPct: { fontSize: 12, color: '#71717a', marginTop: 8, textAlign: 'right' as const },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 32 },
  card: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid #1e1e2e',
    borderRadius: 12, padding: '20px 16px', textAlign: 'center' as const,
  },
  section: { marginTop: 32 },
  sectionTitle: { fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#d4d4d8' },
  table: { borderRadius: 12, border: '1px solid #1e1e2e', overflow: 'hidden' },
  tableHeader: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '12px 16px', background: 'rgba(255,255,255,0.04)', fontSize: 12, color: '#71717a', fontWeight: 600, textTransform: 'uppercase' as const },
  tableRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '12px 16px', borderTop: '1px solid #1e1e2e', fontSize: 14, color: '#d4d4d8' },
  providerName: { fontWeight: 500 },
};
