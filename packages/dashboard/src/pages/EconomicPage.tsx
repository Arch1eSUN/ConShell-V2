/**
 * EconomicPage — Economic Control Surface Dashboard
 *
 * Read-only observability for survival state, revenue flows,
 * gate policy, and agenda economic shaping.
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import type { EconomicSnapshotResponse, GateStatusResponse, AgendaFactorsResponse } from '../api/client';

// ── Tier color mapping ───────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  thriving: '#00e676',
  normal: '#40c4ff',
  frugal: '#ffc107',
  critical: '#ff6d00',
  terminal: '#ff1744',
  dead: '#9e9e9e',
};

function TierBadge({ tier }: { tier: string }) {
  const color = TIER_COLORS[tier] ?? '#888';
  return (
    <span style={{
      background: `${color}22`,
      color,
      padding: '4px 12px',
      borderRadius: 12,
      fontWeight: 700,
      fontSize: 13,
      textTransform: 'uppercase',
      border: `1px solid ${color}44`,
    }}>
      {tier}
    </span>
  );
}

// ── Main Page ────────────────────────────────────────────────

export function EconomicPage() {
  const [snapshot, setSnapshot] = useState<EconomicSnapshotResponse | null>(null);
  const [gate, setGate] = useState<GateStatusResponse | null>(null);
  const [factors, setFactors] = useState<AgendaFactorsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, g, f] = await Promise.allSettled([
        api.getEconomicSnapshot(),
        api.getGateStatus(),
        api.getAgendaFactors(),
      ]);
      if (s.status === 'fulfilled') setSnapshot(s.value);
      if (g.status === 'fulfilled') setGate(g.value);
      if (f.status === 'fulfilled') setFactors(f.value);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load economic data');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Economic Control Surface</h1>
        <button style={s.refreshBtn} onClick={load} disabled={loading}>
          {loading ? '↻' : '🔄'} Refresh
        </button>
      </div>

      {error && <div style={s.errorBanner}>⚠️ {error}</div>}

      {!snapshot ? (
        <div style={s.loading}>Loading economic state…</div>
      ) : (
        <>
          {/* ── Survival Status ── */}
          <div style={s.section}>
            <h2 style={s.sectionTitle}>Survival Status</h2>
            <div style={s.cardRow}>
              <div style={s.card}>
                <div style={s.cardLabel}>Tier</div>
                <TierBadge tier={snapshot.survivalTier} />
              </div>
              <div style={s.card}>
                <div style={s.cardLabel}>Health</div>
                <div style={s.cardValue}>{snapshot.economicHealth}</div>
              </div>
              <div style={s.card}>
                <div style={s.cardLabel}>Emergency</div>
                <div style={{ ...s.cardValue, color: snapshot.isEmergency ? '#ff1744' : '#00e676' }}>
                  {snapshot.isEmergency ? '🚨 YES' : '✅ NO'}
                </div>
              </div>
            </div>
          </div>

          {/* ── Financial Overview ── */}
          <div style={s.section}>
            <h2 style={s.sectionTitle}>Financial Overview</h2>
            <div style={s.cardRow}>
              <div style={s.card}>
                <div style={s.cardLabel}>Balance</div>
                <div style={s.cardValue}>{fmt(snapshot.currentBalanceCents)}</div>
              </div>
              <div style={s.card}>
                <div style={s.cardLabel}>Reserve</div>
                <div style={s.cardValue}>{fmt(snapshot.reserveCents)}</div>
              </div>
              <div style={s.card}>
                <div style={s.cardLabel}>Burn Rate</div>
                <div style={s.cardValue}>{fmt(snapshot.burnRateCentsPerDay)}/day</div>
              </div>
              <div style={s.card}>
                <div style={s.cardLabel}>Runway</div>
                <div style={s.cardValue}>{snapshot.runwayDays} days</div>
              </div>
            </div>
            <div style={s.cardRow}>
              <div style={s.card}>
                <div style={s.cardLabel}>Revenue</div>
                <div style={{ ...s.cardValue, color: '#00e676' }}>{fmt(snapshot.totalRevenueCents)}</div>
              </div>
              <div style={s.card}>
                <div style={s.cardLabel}>Spend</div>
                <div style={{ ...s.cardValue, color: '#ff6d00' }}>{fmt(snapshot.totalSpendCents)}</div>
              </div>
              <div style={s.card}>
                <div style={s.cardLabel}>Net Flow</div>
                <div style={{
                  ...s.cardValue,
                  color: snapshot.netFlowCentsPerDay >= 0 ? '#00e676' : '#ff1744',
                }}>
                  {snapshot.netFlowCentsPerDay >= 0 ? '+' : ''}{fmt(snapshot.netFlowCentsPerDay)}/day
                </div>
              </div>
              <div style={s.card}>
                <div style={s.cardLabel}>Self-Sustaining</div>
                <div style={s.cardValue}>{snapshot.isSelfSustaining ? '✅' : '❌'}</div>
              </div>
            </div>
          </div>

          {/* ── Gate Status ── */}
          {gate?.explanation && (
            <div style={s.section}>
              <h2 style={s.sectionTitle}>Survival Gate</h2>
              <div style={s.cardRow}>
                <div style={s.card}>
                  <div style={s.cardLabel}>Gate</div>
                  <div style={{
                    ...s.cardValue,
                    color: gate.explanation.isOpen ? '#00e676' : '#ff1744',
                  }}>
                    {gate.explanation.isOpen ? '🟢 OPEN' : '🔴 CLOSED'}
                  </div>
                </div>
                <div style={s.card}>
                  <div style={s.cardLabel}>Accepting</div>
                  <div style={s.cardValue}>{gate.explanation.accepting}</div>
                </div>
                <div style={s.card}>
                  <div style={s.cardLabel}>Background Limit</div>
                  <div style={s.cardValue}>{gate.explanation.backgroundWorkLimit}</div>
                </div>
              </div>
              {gate.explanation.restrictions?.length > 0 && (
                <div style={s.listCard}>
                  <div style={s.cardLabel}>Restrictions</div>
                  <ul style={s.list}>
                    {gate.explanation.restrictions.map((r: string, i: number) => (
                      <li key={i} style={s.listItem}>⚠️ {r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {gate.explanation.activeExemptions?.length > 0 && (
                <div style={s.listCard}>
                  <div style={s.cardLabel}>Active Exemptions</div>
                  <ul style={s.list}>
                    {gate.explanation.activeExemptions.map((e: string, i: number) => (
                      <li key={i} style={s.listItem}>✅ {e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ── Agenda Factors ── */}
          {factors && !factors.error && (
            <div style={s.section}>
              <h2 style={s.sectionTitle}>Agenda Economic Shaping</h2>
              <div style={s.cardRow}>
                <div style={s.card}>
                  <div style={s.cardLabel}>Reserve Pressure</div>
                  <div style={s.cardValue}>{factors.reservePressure}/100</div>
                </div>
                <div style={s.card}>
                  <div style={s.cardLabel}>Net Flow Factor</div>
                  <div style={s.cardValue}>{factors.netFlowFactor}/100</div>
                </div>
                <div style={s.card}>
                  <div style={s.cardLabel}>Burn Urgency</div>
                  <div style={s.cardValue}>{factors.burnRateUrgency}/100</div>
                </div>
                <div style={s.card}>
                  <div style={s.cardLabel}>Overall Pressure</div>
                  <div style={{
                    ...s.cardValue,
                    color: (factors.overallPressureScore ?? 0) > 60 ? '#ff6d00' : '#40c4ff',
                  }}>
                    {(factors.overallPressureScore ?? 0).toFixed(1)}/100
                  </div>
                </div>
              </div>
              <div style={s.listCard}>
                <div style={s.cardLabel}>Explanation</div>
                <div style={s.explanation}>{factors.explanation}</div>
              </div>
            </div>
          )}

          {/* ── Meta ── */}
          <div style={s.meta}>
            Projected at: {new Date(snapshot.projectedAt).toLocaleString()} · Owner: {snapshot.projectionOwner}
          </div>
        </>
      )}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 700, color: '#e8eaed', margin: 0 },
  refreshBtn: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
    color: '#8ab4f8', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  },
  loading: { color: '#9aa0a6', textAlign: 'center', padding: 40, fontSize: 15 },
  errorBanner: {
    background: 'rgba(255,23,68,0.12)', color: '#ff6d00', padding: '12px 16px',
    borderRadius: 8, marginBottom: 16, fontSize: 13,
  },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 15, fontWeight: 600, color: '#9aa0a6', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  cardRow: { display: 'flex', gap: 12, flexWrap: 'wrap' as const },
  card: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, padding: '14px 18px', flex: '1 1 140px', minWidth: 140,
  },
  cardLabel: { fontSize: 11, color: '#9aa0a6', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  cardValue: { fontSize: 18, fontWeight: 700, color: '#e8eaed' },
  listCard: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, padding: '14px 18px', marginTop: 12,
  },
  list: { margin: '8px 0 0', padding: 0, listStyle: 'none' },
  listItem: { fontSize: 13, color: '#e8eaed', padding: '4px 0' },
  explanation: { fontSize: 13, color: '#8ab4f8', marginTop: 8, lineHeight: 1.5 },
  meta: { fontSize: 11, color: '#5f6368', textAlign: 'center', marginTop: 24 },
};
