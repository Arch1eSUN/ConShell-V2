/**
 * SkillsPage — 技能管理
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface Skill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  version?: string;
  source?: string;
}

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
      await api.rawRequest(`/api/skills/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
      setSkills(prev => prev.map(s => s.id === id ? { ...s, enabled } : s));
    } catch (err) {
      console.error('Toggle skill failed:', err);
    }
  };

  const filtered = skills.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Skills</h1>
        <input
          style={s.search}
          placeholder="Search skills…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <p style={s.subtitle}>{skills.length} installed · {skills.filter(s => s.enabled).length} enabled</p>

      {loading ? (
        <div style={s.loading}>Loading skills…</div>
      ) : filtered.length === 0 ? (
        <div style={s.empty}>
          {search ? 'No skills match your search.' : 'No skills installed. Install via CLI: conshell skills install [name]'}
        </div>
      ) : (
        <div style={s.grid}>
          {filtered.map(skill => (
            <div key={skill.id} style={s.card}>
              <div style={s.cardTop}>
                <span style={s.skillIcon}>⚡</span>
                <div style={{ flex: 1 }}>
                  <div style={s.skillName}>{skill.name}</div>
                  {skill.version && <span style={s.version}>v{skill.version}</span>}
                </div>
                <label style={s.switch}>
                  <input
                    type="checkbox"
                    checked={skill.enabled}
                    onChange={e => toggleSkill(skill.id, e.target.checked)}
                  />
                  <span style={s.slider} />
                </label>
              </div>
              <p style={s.skillDesc}>{skill.description}</p>
              {skill.source && <span style={s.source}>{skill.source}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: 700, color: '#f4f4f5', margin: 0 },
  subtitle: { fontSize: 14, color: '#71717a', margin: '0 0 24px' },
  search: {
    padding: '8px 14px', borderRadius: 8, border: '1px solid #27272a',
    background: '#18181b', color: '#e4e4e7', fontSize: 14, width: 240, outline: 'none',
  },
  loading: { color: '#71717a', padding: 32, textAlign: 'center' as const },
  empty: { color: '#52525b', padding: 48, textAlign: 'center' as const, fontSize: 14 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 },
  card: {
    padding: 20, background: 'rgba(255,255,255,0.02)',
    borderRadius: 12, border: '1px solid #1e1e2e',
  },
  cardTop: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 },
  skillIcon: { fontSize: 20 },
  skillName: { fontWeight: 600, fontSize: 15, color: '#f4f4f5' },
  version: { fontSize: 11, color: '#52525b', marginLeft: 4 },
  skillDesc: { fontSize: 13, color: '#a1a1aa', margin: '8px 0 0', lineHeight: 1.5 },
  source: { fontSize: 11, color: '#52525b', display: 'inline-block', marginTop: 8 },
  switch: { position: 'relative' as const, display: 'inline-block', width: 40, height: 22 },
  slider: {
    position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0,
    background: '#27272a', borderRadius: 22, cursor: 'pointer',
  },
};
