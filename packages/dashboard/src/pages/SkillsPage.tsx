import { useState, useEffect } from 'react';
import { Puzzle, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import { api } from '../api';

interface Skill { id: string; name: string; description: string; enabled: boolean; version?: string; source?: string; }

export function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.rawRequest<{ skills: Skill[] }>('/api/skills')
      .then(data => setSkills(data.skills ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleSkill = async (id: string, enabled: boolean) => {
    try {
      await api.rawRequest(`/api/skills/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) });
      setSkills(prev => prev.map(s => s.id === id ? { ...s, enabled } : s));
    } catch {}
  };

  const filtered = skills.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <header className="page-header">
        <span className="page-label label">Extensions</span>
        <h2 className="page-title">Skills</h2>
        <p className="page-subtitle">{skills.length} installed · {skills.filter(s => s.enabled).length} enabled</p>
      </header>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-lg)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', padding: '6px 12px', maxWidth: 320 }}>
        <Search size={14} style={{ color: 'var(--ink-muted)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search skills…"
          style={{ border: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 14, outline: 'none', flex: 1, fontFamily: 'var(--font-ui)' }} />
      </div>

      {loading ? <div className="skeleton" style={{ height: 200, borderRadius: 10 }} /> : filtered.length === 0 ? (
        <div style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: 48, fontSize: 14 }}>
          <Puzzle size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
          <p>{search ? 'No skills match your search.' : 'No skills installed. Install via CLI: conshell skills install [name]'}</p>
        </div>
      ) : (
        <div className="data-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {filtered.map(skill => (
            <div key={skill.id} className="card">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                <div className={`card-icon ${skill.enabled ? 'green' : ''}`} style={{ flexShrink: 0 }}><Puzzle size={14} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{skill.name}</div>
                  {skill.version && <span className="data-label" style={{ fontSize: 11 }}>v{skill.version}</span>}
                </div>
                <button onClick={() => toggleSkill(skill.id, !skill.enabled)} style={{
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  color: skill.enabled ? 'var(--green)' : 'var(--ink-muted)',
                }}>
                  {skill.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--ink-secondary)', margin: '4px 0 0', lineHeight: 1.5, paddingLeft: 36 }}>{skill.description}</p>
              {skill.source && <span className="data-label" style={{ display: 'block', marginTop: 6, paddingLeft: 36, fontSize: 11 }}>{skill.source}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
