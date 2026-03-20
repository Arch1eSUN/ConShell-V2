import { useState, useEffect } from 'react';
import { BarChart3, MessageSquare, Coins, Brain, Zap, RefreshCw } from 'lucide-react';
import { api } from '../api';

export function MetricsPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try { setMetrics(await api.getMetrics()); } 
    catch (err) { 
      console.error(err); 
      setMetrics({ totalTurns: 0, totalSpentCents: 0, memoryCount: 0, toolCallCount: 0, dailySpentCents: 0, dailyBudgetCents: 100 }); 
    }
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const budgetPct = metrics
    ? Math.min(100, ((metrics.dailySpentCents / Math.max(1, metrics.dailyBudgetCents)) * 100))
    : 0;

  const statCards = [
    { icon: MessageSquare, label: 'Total Turns', value: metrics?.totalTurns ?? 0, color: 'blue' },
    { icon: Coins, label: 'Total Spent', value: `$${((metrics?.totalSpentCents ?? 0) / 100).toFixed(2)}`, color: 'amber' },
    { icon: Brain, label: 'Memories', value: metrics?.memoryCount ?? 0, color: 'rose' },
    { icon: Zap, label: 'Tool Calls', value: metrics?.toolCallCount ?? 0, color: 'green' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <div>
          <header className="page-header" style={{ marginBottom: 0 }}>
            <span className="page-label label">Analytics</span>
            <h2 className="page-title">Metrics</h2>
          </header>
        </div>
        <button onClick={load} disabled={refreshing} style={{
          padding: '8px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border-strong)',
          background: 'transparent', color: 'var(--ink-secondary)', cursor: 'pointer', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-ui)',
        }}>
          <RefreshCw size={14} className={refreshing ? 'spinning' : ''} /> Refresh
        </button>
      </div>

      {!metrics ? <div className="skeleton" style={{ height: 200, borderRadius: 10 }} /> : (
        <>
          {/* Budget bar */}
          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span className="data-label">Daily Budget</span>
              <span className="mono" style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                ${(metrics.dailySpentCents / 100).toFixed(2)} / ${(metrics.dailyBudgetCents / 100).toFixed(2)}
              </span>
            </div>
            <div style={{ height: 8, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4, transition: 'width 0.5s ease', width: `${budgetPct}%`,
                background: budgetPct > 80 ? 'var(--rose)' : budgetPct > 50 ? 'var(--amber)' : 'var(--green)',
              }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 6, textAlign: 'right' }}>{budgetPct.toFixed(0)}% used</div>
          </div>

          {/* Stats grid */}
          <div className="data-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', marginBottom: 'var(--space-xl)' }}>
            {statCards.map(card => (
              <div key={card.label} className="card" style={{ textAlign: 'center' }}>
                <card.icon size={20} style={{ color: `var(--${card.color})`, marginBottom: 8 }} />
                <div className="big-number">{card.value}</div>
                <div className="data-label">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Cost breakdown */}
          {metrics.costBreakdown && (
            <div className="card">
              <div className="card-header">
                <div className="card-icon blue"><BarChart3 size={16} /></div>
                <span className="card-title">Cost by Provider</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '8px 0', borderBottom: '1px solid var(--border-strong)' }}>
                  <span className="data-label">Provider</span><span className="data-label">Requests</span><span className="data-label">Cost</span>
                </div>
                {Object.entries(metrics.costBreakdown as Record<string, { requests: number; costCents: number }>).map(([name, d]) => (
                  <div key={name} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                    <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{name}</span>
                    <span className="mono" style={{ color: 'var(--ink-secondary)' }}>{d.requests}</span>
                    <span className="mono" style={{ color: 'var(--ink-secondary)' }}>${(d.costCents / 100).toFixed(3)}</span>
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
