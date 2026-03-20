/**
 * PresencePage — V2 Canonical Homepage
 *
 * Three-layer canonical structure:
 *   1. Hero Presence Band — alive/degraded/critical status + name + uptime
 *   2. Truth Grid — 5 dimensional truth cards (Economic / Identity / Collective / Governance / Agenda)
 *   3. Recommended Interventions — prioritized operator actions with actionable buttons
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity,
    DollarSign,
    Fingerprint,
    Users,
    Shield,
    Zap,
    Clock,
    TrendingUp,
    Link2,
    AlertTriangle,
    CalendarClock,
    ListChecks,
    CheckCircle,
    ExternalLink,
    AlertCircle,
    Download,
    Stethoscope,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api, {
    type PostureResponse,
    type InterventionItem,
    type DoctorResponse,
} from '../api/client';

export function PresencePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [posture, setPosture] = useState<PostureResponse | null>(null);
    const [interventions, setInterventions] = useState<InterventionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(false);
    const [doctorReport, setDoctorReport] = useState<string | null>(null);
    const [showDoctor, setShowDoctor] = useState(false);
    const [doctorLoading, setDoctorLoading] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setFetchError(false);
            const [p, i] = await Promise.allSettled([
                api.getPosture(),
                api.getInterventions(),
            ]);
            setPosture(p.status === 'fulfilled' ? p.value : fallbackPosture());
            if (p.status === 'rejected') setFetchError(true);
            if (i.status === 'fulfilled') setInterventions(i.value.interventions);
        } catch {
            setPosture(fallbackPosture());
            setFetchError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const id = setInterval(fetchData, 30_000);
        return () => clearInterval(id);
    }, [fetchData]);

    // G5: Staleness detection — warn if posture is >60s old
    const isStale = useMemo(() => {
        if (!posture) return false;
        const age = Date.now() - new Date(posture.timestamp).getTime();
        return age > 60_000;
    }, [posture]);

    // G3/G4: Operator actions — doctor report + posture export
    const handleRunDoctor = useCallback(async () => {
        setDoctorLoading(true);
        try {
            const res = await api.getDoctorReport();
            setDoctorReport(res.report);
            setShowDoctor(true);
        } catch {
            setDoctorReport('Error: Could not fetch doctor report');
            setShowDoctor(true);
        } finally {
            setDoctorLoading(false);
        }
    }, []);

    const handleExportPosture = useCallback(async () => {
        try {
            const snap = await api.exportPosture();
            const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `posture-${new Date().toISOString().slice(0, 19)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            // silent fail — user will notice no download
        }
    }, []);

    if (loading) {
        return (
            <div>
                <header className="page-header">
                    <span className="page-label label">{t('nav.presence')}</span>
                    <h2 className="page-title">{t('presence.title')}</h2>
                </header>
                <div className="skeleton" style={{ height: 140, borderRadius: 10, marginBottom: 24 }} />
                <div className="overview-grid">
                    <div className="skeleton" style={{ height: 240, borderRadius: 10 }} />
                    <div className="skeleton" style={{ height: 240, borderRadius: 10 }} />
                </div>
            </div>
        );
    }

    const p = posture!;
    const isAlive = p.healthVerdict === 'healthy' || p.healthVerdict === 'degraded';
    const verdictKey = VERDICT_KEY[p.healthVerdict] ?? 'heroAlive';
    const tierBadgeColor = TIER_COLORS[p.economic.survivalTier] || 'green';

    return (
        <div>
            <header className="page-header">
                <span className="page-label label">{t('nav.presence')}</span>
                <h2 className="page-title">{t('presence.title')}</h2>
            </header>

            {/* ═══════════════════════════════════════════════════════════
                Layer 1: Hero Presence Band
                ═══════════════════════════════════════════════════════ */}
            <section className="presence-hero">
                <div className="card presence-hero-card">
                    <div className="presence-hero-inner">
                        <div className="presence-hero-status">
                            <span className={`presence-beacon ${isAlive ? 'alive' : 'critical'}`} />
                            <span className={`presence-verdict ${isAlive ? 'alive' : 'critical'}`}>
                                {t(`presence.${verdictKey}`)}
                            </span>
                        </div>
                        <div className="presence-hero-meta">
                            <div className="presence-hero-stat">
                                <span className="data-label">{t('presence.healthScore')}</span>
                                <span className={`big-number ${p.overallHealthScore >= 80 ? 'positive' : p.overallHealthScore >= 50 ? 'warning' : 'negative'}`}>
                                    {p.overallHealthScore}
                                    <span className="unit">/100</span>
                                </span>
                            </div>
                            <div className="presence-hero-stat">
                                <span className="data-label">{t('presence.survivalTier')}</span>
                                <span className={`badge ${tierBadgeColor}`} style={{ fontSize: '1rem', padding: '4px 12px' }}>
                                    {p.economic.survivalTier}
                                </span>
                            </div>
                            <div className="presence-hero-stat">
                                <span className="data-label">{t('presence.version')}</span>
                                <span className="data-value info">{p.version}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════
                Operator Action Bar — Doctor + Export (G3/G4 Round 19.9)
                ═══════════════════════════════════════════════════════ */}
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)', flexWrap: 'wrap' }}>
                <button
                    className="btn btn-sm"
                    onClick={handleRunDoctor}
                    disabled={doctorLoading}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                        color: 'var(--text-1)', fontSize: '0.8rem', fontFamily: 'var(--font-ui)',
                    }}
                >
                    <Stethoscope size={14} />
                    {doctorLoading ? 'Running...' : 'Run Doctor'}
                </button>
                <button
                    className="btn btn-sm"
                    onClick={handleExportPosture}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                        color: 'var(--text-1)', fontSize: '0.8rem', fontFamily: 'var(--font-ui)',
                    }}
                >
                    <Download size={14} />
                    Export Posture
                </button>
            </div>

            {/* Doctor Report Panel */}
            {showDoctor && doctorReport && (
                <div className="card" style={{ marginTop: 'var(--space-sm)', position: 'relative' }}>
                    <button
                        onClick={() => setShowDoctor(false)}
                        style={{
                            position: 'absolute', top: 8, right: 12, background: 'none',
                            border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '1rem',
                        }}
                    >
                        ✕
                    </button>
                    <pre style={{
                        whiteSpace: 'pre-wrap', fontSize: '0.78rem', lineHeight: 1.5,
                        fontFamily: 'var(--font-mono)', color: 'var(--text-1)',
                        margin: 0, padding: 'var(--space-sm)',
                    }}>
                        {doctorReport}
                    </pre>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                Layer 2: Truth Grid — 6 Dimensional Truth
                ═══════════════════════════════════════════════════════ */}
            <section style={{ marginTop: 'var(--space-lg)' }}>
                <h3 className="section-label">{t('presence.truthGrid')}</h3>
                <div className="overview-grid" style={{ marginTop: 'var(--space-sm)' }}>
                    {/* Economic Truth */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-icon amber">
                                <DollarSign />
                            </div>
                            <span className="card-title">{t('presence.economicTruth')}</span>
                        </div>

                        <div style={{ marginBottom: 'var(--space-md)', paddingBottom: 'var(--space-md)' }}>
                            <span className="data-label" style={{ marginBottom: 6, display: 'block' }}>
                                {t('presence.netBalance')}
                            </span>
                            <span className="big-number">
                                {(p.economic.balanceCents / 100).toFixed(2)}
                                <span className="unit">USDC</span>
                            </span>
                        </div>

                        <div className="separator" />

                        <div className="data-grid">
                            <div className="data-item">
                                <span className="data-label">{t('presence.burnRate')}</span>
                                <span className="data-value">
                                    <Clock size={13} style={{ opacity: 0.5 }} />
                                    {(p.economic.burnRateCentsPerDay / 100).toFixed(2)}/day
                                </span>
                            </div>
                            <div className="data-item">
                                <span className="data-label">{t('presence.runway')}</span>
                                <span className={`data-value ${p.economic.runwayDays > 30 ? 'positive' : p.economic.runwayDays > 7 ? 'warning' : 'negative'}`}>
                                    {p.economic.runwayDays.toFixed(0)} days
                                </span>
                            </div>
                            <div className="data-item">
                                <span className="data-label">{t('presence.profitability')}</span>
                                <span className={`data-value ${p.economic.profitabilityRatio > 0 ? 'positive' : 'negative'}`}>
                                    <TrendingUp size={13} style={{ opacity: 0.5 }} />
                                    {(p.economic.profitabilityRatio * 100).toFixed(0)}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Identity Truth */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-icon violet">
                                <Fingerprint />
                            </div>
                            <span className="card-title">{t('presence.identityTruth')}</span>
                        </div>
                        <div className="data-grid">
                            <div className="data-item">
                                <span className="data-label">{t('presence.mode')}</span>
                                <span className="data-value info">{p.identity.mode}</span>
                            </div>
                            <div className="data-item">
                                <span className="data-label">{t('presence.chainValid')}</span>
                                <span className="data-value">
                                    <span className={`status-dot ${p.identity.chainValid ? 'alive' : 'dead'}`} />
                                    {p.identity.chainValid ? t('presence.valid') : t('presence.broken')}
                                </span>
                            </div>
                            <div className="data-item">
                                <span className="data-label">{t('presence.chainLength')}</span>
                                <span className="data-value">
                                    <Link2 size={13} style={{ opacity: 0.5 }} />
                                    {p.identity.chainLength}
                                </span>
                            </div>
                            <div className="data-item">
                                <span className="data-label">{t('presence.soulDrift')}</span>
                                <span className={`data-value ${p.identity.soulDrifted ? 'negative' : 'positive'}`}>
                                    {p.identity.soulDrifted ? `⚠ ${t('presence.drifted')}` : `✓ ${t('presence.aligned')}`}
                                </span>
                            </div>
                        </div>

                        <div className="separator" />

                        <div className="data-item">
                            <span className="data-label">{t('presence.fingerprint')}</span>
                            <code
                                className="data-value info"
                                style={{ cursor: 'pointer', fontSize: '0.8rem' }}
                                onClick={() => navigator.clipboard.writeText(p.identity.fingerprint)}
                                title="Click to copy"
                            >
                                {p.identity.fingerprint.slice(0, 12)}…{p.identity.fingerprint.slice(-6)}
                            </code>
                        </div>
                    </div>

                    {/* Collective Status */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-icon blue">
                                <Users />
                            </div>
                            <span className="card-title">{t('presence.collectiveStatus')}</span>
                        </div>
                        <div className="data-grid">
                            <div className="data-item">
                                <span className="data-label">{t('presence.totalPeers')}</span>
                                <span className="data-value">{p.collective.totalPeers}</span>
                            </div>
                            <div className="data-item">
                                <span className="data-label">{t('presence.trusted')}</span>
                                <span className="data-value positive">{p.collective.trustedPeers}</span>
                            </div>
                            <div className="data-item">
                                <span className="data-label">{t('presence.degraded')}</span>
                                <span className={`data-value ${p.collective.degradedPeers === 0 ? 'positive' : 'negative'}`}>
                                    {p.collective.degradedPeers}
                                </span>
                            </div>
                            <div className="data-item">
                                <span className="data-label">{t('presence.delegationRate')}</span>
                                <span className={`data-value ${p.collective.delegationSuccessRate >= 0.8 ? 'positive' : 'warning'}`}>
                                    {(p.collective.delegationSuccessRate * 100).toFixed(0)}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Governance Pressure */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-icon rose">
                                <Shield />
                            </div>
                            <span className="card-title">{t('presence.governancePressure')}</span>
                        </div>
                        <div className="data-grid">
                            <div className="data-item">
                                <span className="data-label">{t('presence.pending')}</span>
                                <span className="data-value">{p.governance.pendingProposals}</span>
                            </div>
                            <div className="data-item">
                                <span className="data-label">{t('presence.recentVerdicts')}</span>
                                <span className="data-value">{p.governance.recentVerdicts}</span>
                            </div>
                            <div className="data-item">
                                <span className="data-label">{t('presence.selfMod')}</span>
                                <span className="data-value">
                                    <span className={`status-dot ${p.governance.selfModQuarantined ? 'dead' : 'alive'}`} />
                                    {p.governance.selfModQuarantined ? t('presence.quarantined') : t('presence.active')}
                                </span>
                            </div>
                            <div className="data-item">
                                <span className="data-label">{t('presence.children')}</span>
                                <span className="data-value positive">
                                    <Zap size={13} style={{ opacity: 0.5 }} />
                                    {p.lineage.activeChildren} {t('presence.alive')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Agenda Truth (G4 — Lifeform Closure Visibility) */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-icon green">
                                <CalendarClock />
                            </div>
                            <span className="card-title">{t('presence.agendaTruth')}</span>
                        </div>
                        <div className="data-grid">
                            <div className="data-item">
                                <span className="data-label">{t('presence.scheduled')}</span>
                                <span className="data-value">
                                    <ListChecks size={13} style={{ opacity: 0.5 }} />
                                    {p.agenda.scheduled}
                                </span>
                            </div>
                            <div className="data-item">
                                <span className="data-label">{t('presence.deferred')}</span>
                                <span className={`data-value ${p.agenda.deferred > 0 ? 'warning' : 'positive'}`}>
                                    {p.agenda.deferred}
                                </span>
                            </div>
                            <div className="data-item">
                                <span className="data-label">{t('presence.priorityReason')}</span>
                                <span className="data-value info" style={{ fontSize: '0.8rem' }}>
                                    {p.agenda.priorityReason}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════
                Layer 3: Recommended Interventions
                ═══════════════════════════════════════════════════════ */}
            <section style={{ marginTop: 'var(--space-lg)' }}>
                <h3 className="section-label">
                    {t('presence.recommendedActions')}
                    {/* G5: Staleness + Error indicators */}
                    {isStale && posture && (
                        <span style={{ marginLeft: 8, fontSize: '0.7rem', color: 'var(--amber-text)', fontWeight: 400 }}>
                            <AlertCircle size={12} style={{ verticalAlign: -2, marginRight: 2 }} />
                            stale ({Math.round((Date.now() - new Date(posture.timestamp).getTime()) / 1000)}s)
                        </span>
                    )}
                    {fetchError && (
                        <span style={{ marginLeft: 8, fontSize: '0.7rem', color: 'var(--rose-text)', fontWeight: 400 }}>
                            <AlertTriangle size={12} style={{ verticalAlign: -2, marginRight: 2 }} />
                            backend unavailable
                        </span>
                    )}
                </h3>
                {interventions.length > 0 ? (
                    <div className="card" style={{ marginTop: 'var(--space-sm)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            {interventions.map(item => (
                                <div
                                    key={item.id}
                                    className="list-row"
                                    style={{
                                        background: SEVERITY_BG[item.severity],
                                    }}
                                >
                                    <div style={{ flex: 1 }}>
                                        <span style={{
                                            fontFamily: 'var(--font-ui)',
                                            fontSize: '0.875rem',
                                            fontWeight: 500,
                                            color: SEVERITY_COLOR[item.severity],
                                        }}>
                                            {item.title}
                                        </span>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 2 }}>
                                            {item.description}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                                        {/* G3: Operator action — navigate to dimension detail */}
                                        <button
                                            className="btn-sm"
                                            onClick={() => navigate(DIMENSION_ROUTES[item.dimension] ?? '/')}
                                            style={{
                                                fontSize: '0.7rem',
                                                padding: '2px 8px',
                                                borderRadius: 4,
                                                border: '1px solid var(--border)',
                                                background: 'transparent',
                                                color: 'var(--ink-secondary)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4,
                                            }}
                                        >
                                            <ExternalLink size={10} />
                                            Inspect
                                        </button>
                                        <span className={`badge ${SEVERITY_BADGE[item.severity]}`}>
                                            {item.dimension}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="card" style={{ marginTop: 'var(--space-sm)', textAlign: 'center', padding: 'var(--space-xl)' }}>
                        <CheckCircle size={32} style={{ opacity: 0.3, marginBottom: 'var(--space-sm)' }} />
                        <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem' }}>
                            {t('presence.noInterventions')}
                        </p>
                    </div>
                )}
            </section>
        </div>
    );
}

/* ── Constants ──────────────────────────────────────────────────────── */

const VERDICT_KEY: Record<string, string> = {
    healthy: 'heroAlive',
    degraded: 'heroDegraded',
    critical: 'heroCritical',
    terminal: 'heroTerminal',
};

const TIER_COLORS: Record<string, string> = {
    thriving: 'green',
    normal: 'green',
    survival: 'amber',
    critical: 'rose',
    terminal: 'rose',
};

const SEVERITY_BG: Record<string, string> = {
    info: 'var(--blue-bg)',
    warning: 'var(--amber-bg)',
    critical: 'var(--rose-bg)',
};

const SEVERITY_COLOR: Record<string, string> = {
    info: 'var(--blue-text)',
    warning: 'var(--amber-text)',
    critical: 'var(--rose-text)',
};

const SEVERITY_BADGE: Record<string, string> = {
    info: 'blue',
    warning: 'amber',
    critical: 'rose',
};

// G3: Dimension → route mapping for intervention action buttons
const DIMENSION_ROUTES: Record<string, string> = {
    identity: '/',
    runtime: '/',
    survival: '/economic',
    governance: '/constitution',
    collective: '/network',
};

function fallbackPosture(): PostureResponse {
    return {
        agentId: 'conshell-local',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        identity: {
            mode: 'sovereign',
            chainValid: true,
            chainLength: 1,
            soulDrifted: false,
            fingerprint: 'ab3f7c92e1d04a8b9c5f2e7d6a1b3c4d5e6f7a8b',
        },
        economic: {
            survivalTier: 'normal',
            balanceCents: 4200,
            burnRateCentsPerDay: 85,
            runwayDays: 49,
            profitabilityRatio: 0.12,
        },
        lineage: {
            activeChildren: 0,
            degradedChildren: 0,
            totalFundingAllocated: 0,
            totalFundingSpent: 0,
            healthScore: 100,
        },
        collective: {
            totalPeers: 0,
            trustedPeers: 0,
            degradedPeers: 0,
            delegationSuccessRate: 1.0,
        },
        governance: {
            pendingProposals: 0,
            recentVerdicts: 0,
            selfModQuarantined: false,
        },
        agenda: {
            scheduled: 0,
            deferred: 0,
            active: 0,
            blocked: 0,
            nextCommitmentHint: 'none',
            priorityReason: 'no active commitments',
        },
        overallHealthScore: 100,
        healthVerdict: 'healthy',
    };
}
