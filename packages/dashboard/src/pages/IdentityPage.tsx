import { useState, useEffect } from 'react';
import { Fingerprint, ShieldCheck, Globe, Tag } from 'lucide-react';
import { api } from '../api';

export function IdentityPage() {
  const [identity, setIdentity] = useState<any>(null);

  useEffect(() => {
    api.rawRequest<any>('/api/identity')
      .then(setIdentity)
      .catch(err => {
        console.error(err);
        setIdentity({
          agentName: 'Unknown', model: 'Unknown', personality: 'Unknown',
          walletAddress: '0x00...00', chain: 'Unknown', tier: 'Unknown', version: '1.0'
        });
      });
  }, []);

  if (!identity) return <div className="skeleton" style={{ height: 200, borderRadius: 10 }} />;

  return (
    <div>
      <header className="page-header">
        <span className="page-label label">Profile</span>
        <h2 className="page-title">Identity</h2>
        <p className="page-subtitle">Agent soul, genesis prompt, and on-chain identity</p>
      </header>

      <div className="data-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
        {/* Soul */}
        <div className="card">
          <div className="card-header">
            <div className="card-icon green"><Fingerprint size={16} /></div>
            <span className="card-title">Soul</span>
          </div>
          <div className="data-item"><span className="data-label">Name</span><span className="data-value">{identity.agentName ?? identity.name ?? '—'}</span></div>
          <div className="data-item"><span className="data-label">Model</span><span className="data-value mono">{identity.model ?? '—'}</span></div>
          <div className="data-item"><span className="data-label">Personality</span><span className="data-value">{identity.personality ?? identity.alignment ?? '—'}</span></div>
        </div>

        {/* On-Chain */}
        <div className="card">
          <div className="card-header">
            <div className="card-icon blue"><Globe size={16} /></div>
            <span className="card-title">On-Chain Identity</span>
          </div>
          <div className="data-item"><span className="data-label">Address</span><span className="data-value mono" style={{ fontSize: 12 }}>{identity.walletAddress ?? identity.address ?? '—'}</span></div>
          <div className="data-item"><span className="data-label">Chain</span><span className="data-value">{identity.chain ?? 'Base'}</span></div>
          <div className="data-item">
            <span className="data-label">Status</span>
            <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={12} /> Verified
            </span>
          </div>
        </div>

        {/* Tier & Tags */}
        <div className="card">
          <div className="card-header">
            <div className="card-icon amber"><Tag size={16} /></div>
            <span className="card-title">Classification</span>
          </div>
          <div className="data-item">
            <span className="data-label">Tier</span>
            <span className="badge badge-blue">{identity.tier ?? identity.securityLevel ?? 'standard'}</span>
          </div>
          <div className="data-item">
            <span className="data-label">Version</span>
            <span className="data-value mono">{identity.version ?? '—'}</span>
          </div>
          <div className="data-item">
            <span className="data-label">Security</span>
            <span className="data-value">{identity.securityLevel ?? 'standard'}</span>
          </div>
        </div>
      </div>

      {/* Genesis Prompt */}
      {identity.genesisPrompt && (
        <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
          <div className="card-header">
            <div className="card-icon rose"><Fingerprint size={16} /></div>
            <span className="card-title">Genesis Prompt</span>
          </div>
          <pre style={{
            fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
            color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)',
            padding: 12, background: 'var(--surface)', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', maxHeight: 300, overflow: 'auto',
          }}>{identity.genesisPrompt}</pre>
        </div>
      )}
    </div>
  );
}
