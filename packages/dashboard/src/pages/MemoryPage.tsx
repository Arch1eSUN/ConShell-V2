import { useState, useEffect } from 'react';
import { Brain, Flame, Thermometer, Snowflake, Database, Search } from 'lucide-react';
import { api } from '../api';

interface MemoryEntry { id: string; tier: 'hot' | 'warm' | 'cold'; content: string; created_at: string; score?: number; }

export function MemoryPage() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.rawRequest<{ entries: MemoryEntry[] }>('/api/memory')
      .then(data => setEntries(data.entries ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = entries.filter(e => e.content.toLowerCase().includes(search.toLowerCase()));
  const hot = entries.filter(e => e.tier === 'hot').length;
  const warm = entries.filter(e => e.tier === 'warm').length;
  const cold = entries.filter(e => e.tier === 'cold').length;

  const tierIcon = (t: string) => {
    if (t === 'hot') return <Flame size={14} style={{ color: 'var(--rose)' }} />;
    if (t === 'warm') return <Thermometer size={14} style={{ color: 'var(--amber)' }} />;
    return <Snowflake size={14} style={{ color: 'var(--blue)' }} />;
  };

  const tierBadgeClass = (t: string) => t === 'hot' ? 'badge-rose' : t === 'warm' ? 'badge-amber' : 'badge-blue';

  return (
    <div>
      <header className="page-header">
        <span className="page-label label">Data</span>
        <h2 className="page-title">Memory</h2>
        <p className="page-subtitle">Agent memory tiers and recall</p>
      </header>

      <div className="data-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 'var(--space-lg)' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <Flame size={20} style={{ color: 'var(--rose)', marginBottom: 8 }} />
          <div className="big-number">{hot}</div>
          <div className="data-label">Hot</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <Thermometer size={20} style={{ color: 'var(--amber)', marginBottom: 8 }} />
          <div className="big-number">{warm}</div>
          <div className="data-label">Warm</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <Snowflake size={20} style={{ color: 'var(--blue)', marginBottom: 8 }} />
          <div className="big-number">{cold}</div>
          <div className="data-label">Cold</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ marginBottom: 12 }}>
          <div className="card-icon green"><Brain size={16} /></div>
          <span className="card-title">Entries</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', padding: '4px 8px' }}>
            <Search size={13} style={{ color: 'var(--ink-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search memories…"
              style={{ border: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 13, outline: 'none', width: 160, fontFamily: 'var(--font-ui)' }} />
          </div>
        </div>

        {loading ? <div className="skeleton" style={{ height: 120, borderRadius: 8 }} /> : filtered.length === 0 ? (
          <div style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: 40, fontSize: 14 }}>
            <Database size={32} style={{ opacity: 0.2, marginBottom: 8 }} /><p>{search ? 'No matches' : 'No memory entries yet'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map(entry => (
              <div key={entry.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                {tierIcon(entry.tier)}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>{entry.content}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 4 }}>
                    <span className={`badge ${tierBadgeClass(entry.tier)}`}>{entry.tier}</span>
                    <span style={{ marginLeft: 8 }}>{new Date(entry.created_at).toLocaleDateString()}</span>
                    {entry.score != null && <span style={{ marginLeft: 8 }}>Score: {entry.score.toFixed(2)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
