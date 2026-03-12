/**
 * IdentityPage — Agent身份 + SOUL信息
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';

export function IdentityPage() {
  const [identity, setIdentity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.rawRequest<any>('/api/agent/status')
      .then(setIdentity)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 style={s.title}>Identity</h1>
      <p style={s.subtitle}>Agent soul, alignment, and on-chain identity</p>

      {loading ? (
        <div style={s.loading}>Loading…</div>
      ) : (
        <>
          {/* Soul Card */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <span style={{ fontSize: 28 }}>🐢</span>
              <div>
                <h2 style={s.name}>{identity?.name ?? 'ConShell Agent'}</h2>
                <span style={s.badge}>{identity?.state ?? 'unknown'}</span>
              </div>
            </div>

            <div style={s.fieldGrid}>
              <Field label="Role" value={identity?.role ?? '—'} />
              <Field label="Version" value={identity?.version ?? '—'} />
              <Field label="Created" value={identity?.created ?? '—'} />
              <Field label="Survival Tier" value={identity?.survivalTier ?? '—'} />
            </div>
          </div>

          {/* Genesis Prompt */}
          <div style={s.card}>
            <h3 style={s.sectionTitle}>Genesis Prompt</h3>
            <pre style={s.pre}>{identity?.genesisPrompt ?? 'Not available'}</pre>
          </div>

          {/* On-chain Identity */}
          <div style={s.card}>
            <h3 style={s.sectionTitle}>On-Chain Identity (ERC-8004)</h3>
            <div style={s.fieldGrid}>
              <Field label="Address" value={identity?.walletAddress ?? 'Not connected'} />
              <Field label="Chain" value={identity?.chainId ? `Chain ${identity.chainId}` : '—'} />
              <Field label="Registered" value={identity?.erc8004Registered ? '✓ Yes' : '✗ No'} />
            </div>
          </div>

          {/* Alignment */}
          <div style={s.card}>
            <h3 style={s.sectionTitle}>Alignment Status</h3>
            <div style={s.alignBadge}>
              {identity?.aligned !== false ? '✓ Aligned with SOUL' : '⚠ Alignment drift detected'}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.field}>
      <div style={s.fieldLabel}>{label}</div>
      <div style={s.fieldValue}>{value}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  title: { fontSize: 28, fontWeight: 700, margin: '0 0 8px', color: '#f4f4f5' },
  subtitle: { fontSize: 14, color: '#71717a', margin: '0 0 32px' },
  loading: { color: '#71717a', padding: 32 },
  card: { padding: 24, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid #1e1e2e', marginBottom: 16 },
  cardHeader: { display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 },
  name: { fontSize: 20, fontWeight: 600, margin: 0 },
  badge: { fontSize: 12, color: '#4ade80', background: 'rgba(74,222,128,0.1)', padding: '2px 10px', borderRadius: 20, display: 'inline-block', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: 600, color: '#a1a1aa', marginBottom: 16, marginTop: 0 },
  fieldGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 },
  field: {},
  fieldLabel: { fontSize: 12, color: '#71717a', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  fieldValue: { fontSize: 14, color: '#e4e4e7', marginTop: 4, fontFamily: 'monospace' },
  pre: { fontSize: 13, color: '#a1a1aa', background: '#0a0a0f', padding: 16, borderRadius: 8, overflow: 'auto', whiteSpace: 'pre-wrap' as const, margin: 0 },
  alignBadge: { fontSize: 15, color: '#4ade80', fontWeight: 500 },
};
