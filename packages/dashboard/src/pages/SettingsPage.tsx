import { useState, useEffect } from 'react';
import { Settings, Bot, Cloud, Network, ToggleRight, Save, Check } from 'lucide-react';
import { api, type ConfigResponse } from '../api';

export function SettingsPage() {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { 
    api.getConfig()
      .then(setConfig)
      .catch(err => {
        console.error(err);
        setConfig({
          agentName: 'Unknown', model: 'Unknown', inferenceMode: 'ollama',
          dailyBudgetCents: 0, port: 4200, securityLevel: 'standard',
          proxyEnabled: false, walletEnabled: false,
          channels: [], browserProvider: 'stagehand'
        });
      }); 
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await api.updateConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { alert(`Save failed: ${err}`); }
    setSaving(false);
  };

  if (!config) return <div className="skeleton" style={{ height: 300, borderRadius: 10 }} />;

  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', marginTop: 6, padding: '10px 14px', borderRadius: 'var(--radius)',
    border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)',
    fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-ui)',
  };

  return (
    <div>
      <header className="page-header">
        <span className="page-label label">Config</span>
        <h2 className="page-title">Settings</h2>
        <p className="page-subtitle">Global agent configuration</p>
      </header>

      {/* Agent */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="card-header">
          <div className="card-icon green"><Bot size={16} /></div>
          <span className="card-title">Agent</span>
        </div>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-secondary)', marginBottom: 16 }}>
          Agent Name
          <input style={inputStyle} value={config.agentName} onChange={e => setConfig({ ...config, agentName: e.target.value })} />
        </label>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-secondary)' }}>
          Model
          <input style={inputStyle} value={config.model} onChange={e => setConfig({ ...config, model: e.target.value })} />
        </label>
      </div>

      {/* Inference */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="card-header">
          <div className="card-icon blue"><Cloud size={16} /></div>
          <span className="card-title">Inference</span>
        </div>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-secondary)', marginBottom: 16 }}>
          Mode
          <select style={inputStyle} value={config.inferenceMode} onChange={e => setConfig({ ...config, inferenceMode: e.target.value })}>
            <option value="ollama">Ollama (Local)</option>
            <option value="cliproxy">CLIProxy</option>
            <option value="direct-api">Direct API</option>
            <option value="conway-cloud">Conway Cloud</option>
          </select>
        </label>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-secondary)' }}>
          Daily Budget (cents)
          <input style={inputStyle} type="number" value={config.dailyBudgetCents} onChange={e => setConfig({ ...config, dailyBudgetCents: parseInt(e.target.value) || 0 })} />
        </label>
      </div>

      {/* Network */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="card-header">
          <div className="card-icon amber"><Network size={16} /></div>
          <span className="card-title">Network</span>
        </div>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-secondary)', marginBottom: 16 }}>
          Port
          <input style={inputStyle} type="number" value={config.port} onChange={e => setConfig({ ...config, port: parseInt(e.target.value) || 4200 })} />
        </label>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-secondary)' }}>
          Security Level
          <select style={inputStyle} value={config.securityLevel} onChange={e => setConfig({ ...config, securityLevel: e.target.value })}>
            <option value="low">Low</option>
            <option value="standard">Standard</option>
            <option value="high">High</option>
            <option value="paranoid">Paranoid</option>
          </select>
        </label>
      </div>

      {/* Features */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="card-header">
          <div className="card-icon rose"><ToggleRight size={16} /></div>
          <span className="card-title">Features</span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--ink)', marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={config.proxyEnabled} onChange={e => setConfig({ ...config, proxyEnabled: e.target.checked })} />
          CLIProxy (OpenAI-compatible API)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--ink)', cursor: 'pointer' }}>
          <input type="checkbox" checked={config.walletEnabled} onChange={e => setConfig({ ...config, walletEnabled: e.target.checked })} />
          Ethereum Wallet
        </label>
      </div>

      <button onClick={save} disabled={saving} style={{
        padding: '12px 32px', borderRadius: 'var(--radius-lg)', border: 'none',
        background: 'var(--green)', color: '#fff', fontWeight: 600, cursor: 'pointer',
        fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-ui)',
      }}>
        {saving ? <><Settings size={14} className="spinning" /> Saving…</> : saved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save Settings</>}
      </button>
    </div>
  );
}
