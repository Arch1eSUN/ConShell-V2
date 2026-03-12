/**
 * MemoryPage — Agent记忆管理
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface Memory {
  id: string;
  tier: 'hot' | 'warm' | 'cold';
  content: string;
  source: string;
  score: number;
  createdAt: string;
  tags?: string[];
}

interface MemoryStats {
  hot: number;
  warm: number;
  cold: number;
  total: number;
}

export function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.allSettled([
      api.rawRequest<{ memories: Memory[] }>('/api/memory'),
      api.rawRequest<MemoryStats>('/api/memory/stats'),
    ]).then(([mem, st]) => {
      if (mem.status === 'fulfilled') setMemories(mem.value.memories ?? []);
      if (st.status === 'fulfilled') setStats(st.value);
      setLoading(false);
    });
  }, []);

  const deleteMemory = async (id: string) => {
    try {
      await api.rawRequest(`/api/memory/${id}`, { method: 'DELETE' });
      setMemories(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const filtered = memories
    .filter(m => tierFilter === 'all' || m.tier === tierFilter)
    .filter(m => !search || m.content.toLowerCase().includes(search.toLowerCase()));

  const tierColors: Record<string, string> = { hot: '#ef4444', warm: '#f59e0b', cold: '#3b82f6' };

  return (
    <div>
      <h1 style={s.title}>Memory</h1>
      <p style={s.subtitle}>3-tier memory system (hot → warm → cold)</p>

      {/* Stats */}
      {stats && (
        <div style={s.statsRow}>
          <div style={s.statCard}>
            <span style={{ color: '#ef4444', fontSize: 20 }}>🔥</span>
            <div style={s.statValue}>{stats.hot}</div>
            <div style={s.statLabel}>Hot</div>
          </div>
          <div style={s.statCard}>
            <span style={{ fontSize: 20 }}>🌤</span>
            <div style={s.statValue}>{stats.warm}</div>
            <div style={s.statLabel}>Warm</div>
          </div>
          <div style={s.statCard}>
            <span style={{ fontSize: 20 }}>❄️</span>
            <div style={s.statValue}>{stats.cold}</div>
            <div style={s.statLabel}>Cold</div>
          </div>
          <div style={s.statCard}>
            <span style={{ fontSize: 20 }}>🧠</span>
            <div style={s.statValue}>{stats.total}</div>
            <div style={s.statLabel}>Total</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={s.filters}>
        <select style={s.select} value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
          <option value="all">All Tiers</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
        </select>
        <input
          style={s.search}
          placeholder="Search memories…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Memory list */}
      {loading ? (
        <div style={s.loading}>Loading memories…</div>
      ) : filtered.length === 0 ? (
        <div style={s.empty}>No memories found.</div>
      ) : (
        <div style={s.list}>
          {filtered.map(mem => (
            <div key={mem.id} style={s.memRow}>
              <div style={{ ...s.tierBadge, background: `${tierColors[mem.tier]}22`, color: tierColors[mem.tier] }}>
                {mem.tier.toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={s.memContent}>{mem.content.slice(0, 200)}{mem.content.length > 200 ? '…' : ''}</div>
                <div style={s.memMeta}>
                  Score: {mem.score.toFixed(2)} · {mem.source} · {new Date(mem.createdAt).toLocaleDateString()}
                  {mem.tags?.length ? ` · ${mem.tags.join(', ')}` : ''}
                </div>
              </div>
              <button style={s.deleteBtn} onClick={() => deleteMemory(mem.id)} title="Delete">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  title: { fontSize: 28, fontWeight: 700, margin: '0 0 8px', color: '#f4f4f5' },
  subtitle: { fontSize: 14, color: '#71717a', margin: '0 0 24px' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 },
  statCard: { textAlign: 'center' as const, padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid #1e1e2e' },
  statValue: { fontSize: 24, fontWeight: 700, color: '#f4f4f5', marginTop: 4 },
  statLabel: { fontSize: 12, color: '#71717a', marginTop: 2 },
  filters: { display: 'flex', gap: 12, marginBottom: 16 },
  select: { padding: '8px 12px', borderRadius: 8, border: '1px solid #27272a', background: '#18181b', color: '#a1a1aa', fontSize: 13 },
  search: { flex: 1, padding: '8px 14px', borderRadius: 8, border: '1px solid #27272a', background: '#18181b', color: '#e4e4e7', fontSize: 14, outline: 'none' },
  loading: { color: '#71717a', padding: 32, textAlign: 'center' as const },
  empty: { color: '#52525b', padding: 48, textAlign: 'center' as const, fontSize: 14 },
  list: { borderRadius: 12, border: '1px solid #1e1e2e', overflow: 'hidden' },
  memRow: { display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 20px', borderBottom: '1px solid #1e1e2e' },
  tierBadge: { fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, flexShrink: 0, marginTop: 2 },
  memContent: { fontSize: 14, color: '#e4e4e7', lineHeight: 1.5 },
  memMeta: { fontSize: 12, color: '#52525b', marginTop: 4 },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 6, border: '1px solid #27272a',
    background: 'transparent', color: '#71717a', cursor: 'pointer', fontSize: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};
