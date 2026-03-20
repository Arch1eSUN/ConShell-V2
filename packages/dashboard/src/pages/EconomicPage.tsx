import { useState, useEffect } from 'react';
import { Banknote, TrendingUp, ShieldCheck, Unlock, Lock, DollarSign, Scale } from 'lucide-react';
import { api } from '../api';

interface GateInfo { name: string; active: boolean; remaining?: string; }
interface EconData {
  dailyBudgetCents?: number; dailySpentCents?: number;
  totalUsdcCents?: number; treasuryUsdcCents?: number;
  gates?: GateInfo[]; tier?: string;
}

export function EconomicPage() {
  const [data, setData] = useState<EconData | null>(null);

  useEffect(() => {
    api.rawRequest<EconData>('/api/economic')
      .then(setData)
      .catch(err => {
        console.error(err);
        setData({
          dailyBudgetCents: 0, dailySpentCents: 0, totalUsdcCents: 0,
          tier: 'Unknown', gates: []
        });
      });
  }, []);

  if (!data) return <div className="skeleton" style={{ height: 300, borderRadius: 10 }} />;

  const budgetPct = data.dailyBudgetCents
    ? Math.min(100, ((data.dailySpentCents ?? 0) / Math.max(1, data.dailyBudgetCents)) * 100)
    : 0;

  return (
    <div>
      <header className="page-header">
        <span className="page-label label">Finance</span>
        <h2 className="page-title">Economic Engine</h2>
        <p className="page-subtitle">Budget allocation and spending gates</p>
      </header>

      <div className="data-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', marginBottom: 'var(--space-lg)' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <DollarSign size={20} style={{ color: 'var(--green)', marginBottom: 8 }} />
          <div className="big-number">${((data.dailySpentCents ?? 0) / 100).toFixed(2)}</div>
          <div className="data-label">Spent Today</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <Scale size={20} style={{ color: 'var(--amber)', marginBottom: 8 }} />
          <div className="big-number">${((data.dailyBudgetCents ?? 0) / 100).toFixed(2)}</div>
          <div className="data-label">Daily Budget</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <Banknote size={20} style={{ color: 'var(--blue)', marginBottom: 8 }} />
          <div className="big-number">${((data.totalUsdcCents ?? 0) / 100).toFixed(2)}</div>
          <div className="data-label">Total USDC</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <TrendingUp size={20} style={{ color: 'var(--rose)', marginBottom: 8 }} />
          <div className="big-number">{data.tier ?? '—'}</div>
          <div className="data-label">Tier</div>
        </div>
      </div>

      {/* Budget bar */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="card-header">
          <div className="card-icon amber"><DollarSign size={16} /></div>
          <span className="card-title">Daily Budget</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)' }}>
            {budgetPct.toFixed(0)}% used
          </span>
        </div>
        <div style={{ height: 8, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden', marginTop: 8 }}>
          <div style={{
            height: '100%', borderRadius: 4, transition: 'width 0.5s ease', width: `${budgetPct}%`,
            background: budgetPct > 80 ? 'var(--rose)' : budgetPct > 50 ? 'var(--amber)' : 'var(--green)',
          }} />
        </div>
      </div>

      {/* Spending Gates */}
      {data.gates && data.gates.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-icon green"><ShieldCheck size={16} /></div>
            <span className="card-title">Spending Gates</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {data.gates.map(gate => (
              <div key={gate.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                {gate.active ? <Unlock size={14} style={{ color: 'var(--green)' }} /> : <Lock size={14} style={{ color: 'var(--ink-muted)' }} />}
                <span style={{ flex: 1, fontWeight: 500, fontSize: 14, color: 'var(--ink)' }}>{gate.name}</span>
                <span className={`badge ${gate.active ? 'badge-green' : ''}`}>{gate.active ? 'Open' : 'Locked'}</span>
                {gate.remaining && <span className="data-label" style={{ marginLeft: 8 }}>{gate.remaining}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
