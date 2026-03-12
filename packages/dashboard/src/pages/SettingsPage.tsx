/**
 * SettingsPage — 全局配置
 */
import React, { useState, useEffect } from 'react';
import { api, type ConfigResponse } from '../api';

export function SettingsPage() {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getConfig().then(setConfig).catch(console.error);
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await api.updateConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(`Save failed: ${err}`);
    }
    setSaving(false);
  };

  if (!config) return <div style={s.loading}>Loading config…</div>;

  return (
    <div>
      <h1 style={s.title}>Settings</h1>

      <div style={s.group}>
        <h2 style={s.groupTitle}>Agent</h2>
        <label style={s.label}>
          Agent Name
          <input style={s.input} value={config.agentName} onChange={e => setConfig({ ...config, agentName: e.target.value })} />
        </label>
        <label style={s.label}>
          Model
          <input style={s.input} value={config.model} onChange={e => setConfig({ ...config, model: e.target.value })} />
        </label>
      </div>

      <div style={s.group}>
        <h2 style={s.groupTitle}>Inference</h2>
        <label style={s.label}>
          Mode
          <select style={s.select} value={config.inferenceMode} onChange={e => setConfig({ ...config, inferenceMode: e.target.value })}>
            <option value="ollama">Ollama (Local)</option>
            <option value="cliproxy">CLIProxy</option>
            <option value="direct-api">Direct API</option>
            <option value="conway-cloud">Conway Cloud</option>
          </select>
        </label>
        <label style={s.label}>
          Daily Budget (cents)
          <input style={s.input} type="number" value={config.dailyBudgetCents} onChange={e => setConfig({ ...config, dailyBudgetCents: parseInt(e.target.value) || 0 })} />
        </label>
      </div>

      <div style={s.group}>
        <h2 style={s.groupTitle}>Network</h2>
        <label style={s.label}>
          Port
          <input style={s.input} type="number" value={config.port} onChange={e => setConfig({ ...config, port: parseInt(e.target.value) || 4200 })} />
        </label>
        <label style={s.label}>
          Security Level
          <select style={s.select} value={config.securityLevel} onChange={e => setConfig({ ...config, securityLevel: e.target.value })}>
            <option value="low">Low</option>
            <option value="standard">Standard</option>
            <option value="high">High</option>
            <option value="paranoid">Paranoid</option>
          </select>
        </label>
      </div>

      <div style={s.group}>
        <h2 style={s.groupTitle}>Features</h2>
        <label style={s.toggle}>
          <input type="checkbox" checked={config.proxyEnabled} onChange={e => setConfig({ ...config, proxyEnabled: e.target.checked })} />
          CLIProxy (OpenAI-compatible API)
        </label>
        <label style={s.toggle}>
          <input type="checkbox" checked={config.walletEnabled} onChange={e => setConfig({ ...config, walletEnabled: e.target.checked })} />
          Ethereum Wallet
        </label>
      </div>

      <button style={s.saveBtn} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Settings'}
      </button>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  title: { fontSize: 28, fontWeight: 700, margin: '0 0 32px', color: '#f4f4f5' },
  loading: { color: '#71717a', padding: 32 },
  group: { marginBottom: 32, padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid #1e1e2e' },
  groupTitle: { fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#a1a1aa' },
  label: { display: 'block', fontSize: 13, color: '#a1a1aa', marginBottom: 16 },
  input: {
    display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 8,
    border: '1px solid #27272a', background: '#18181b', color: '#f4f4f5', fontSize: 14,
    outline: 'none', boxSizing: 'border-box' as const,
  },
  select: {
    display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 8,
    border: '1px solid #27272a', background: '#18181b', color: '#f4f4f5', fontSize: 14,
    outline: 'none', boxSizing: 'border-box' as const,
  },
  toggle: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#d4d4d8', marginBottom: 12, cursor: 'pointer' },
  saveBtn: {
    padding: '12px 32px', borderRadius: 10, border: 'none',
    background: '#6C5CE7', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14,
  },
};
