/**
 * GovernancePage — Constitution & Self-Modification Governance
 *
 * Displays governance proposals, constitutional constraints,
 * self-modification status, and recent verdicts.
 */
import { useState, useEffect, useCallback } from 'react';
import {
    Shield,
    FileText,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Lock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api, { GovernanceProposal, WhatIfProjection } from '../api/client';

function ProposalInbox() {
    const { t } = useTranslation();
    const [proposals, setProposals] = useState<GovernanceProposal[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProp, setSelectedProp] = useState<string | null>(null);
    const [whatIf, setWhatIf] = useState<WhatIfProjection | null>(null);

    const fetchProposals = useCallback(async () => {
        try {
            const res = await api.getProposals();
            // Show only action-needed
            setProposals(res.proposals.filter(p => ['proposed', 'evaluating', 'escalated', 'approved'].includes(p.status)));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProposals();
        const id = setInterval(fetchProposals, 5000);
        return () => clearInterval(id);
    }, [fetchProposals]);

    const handleSelect = async (id: string) => {
        setSelectedProp(id);
        setWhatIf(null);
        try {
            const res = await api.getProposalWhatIf(id);
            setWhatIf(res.projection);
        } catch (e) {
            console.error('Failed to get projection', e);
        }
    };

    const handleApprove = async (id: string) => {
        try {
            await api.approveProposal(id);
            await api.applyProposal(id);
            await fetchProposals();
            setSelectedProp(null);
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) return <div className="skeleton" style={{ height: 100, borderRadius: 10, marginTop: 'var(--space-lg)' }} />;
    if (proposals.length === 0) return null;

    return (
        <section className="overview-full" style={{ marginTop: 'var(--space-lg)' }}>
            <h3 style={{ marginBottom: 'var(--space-md)' }}>Governance Inbox</h3>
            <div className="data-grid" style={{ gridTemplateColumns: '1fr' }}>
                {proposals.map(p => (
                    <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="card-title">{(p.target || p.actionKind).substring(0, 50)}</span>
                            <span className={`status-dot ${p.status === 'escalated' ? 'warning' : 'alive'}`} />
                        </div>
                        <div className="data-item">
                            <span className="data-label">Action</span>
                            <span className="data-value">{p.actionKind}</span>
                        </div>
                        <div className="data-item">
                            <span className="data-label">Justification</span>
                            <span className="data-value">{p.justification}</span>
                        </div>
                        <div className="data-item">
                            <span className="data-label">Status</span>
                            <span className="data-value">{p.status}</span>
                        </div>
                        
                        {selectedProp === p.id ? (
                            <div style={{ marginTop: 'var(--space-sm)', padding: 'var(--space-sm)', background: 'var(--surface-hover)', borderRadius: 'var(--border-radius-sm)' }}>
                                <h4>What-If Projection</h4>
                                {whatIf ? (
                                    <>
                                        <div className="data-item"><span className="data-label">Budget Impact</span><span className="data-value">{whatIf.budgetImpactCents}¢</span></div>
                                        <div className="data-item"><span className="data-label">Resulting Survival Tier</span><span className="data-value">{whatIf.resultingSurvivalTier}</span></div>
                                        {whatIf.blockedWarnings.length > 0 && (
                                            <div className="data-item"><span className="data-label">Warnings</span><span className="data-value warning">{whatIf.blockedWarnings.join(', ')}</span></div>
                                        )}
                                        <button className="button primary" style={{ marginTop: 'var(--space-sm)' }} onClick={() => handleApprove(p.id)}>Confirm Execution</button>
                                        <button className="button" style={{ marginTop: 'var(--space-sm)', marginLeft: 'var(--space-sm)' }} onClick={() => setSelectedProp(null)}>Cancel</button>
                                    </>
                                ) : (
                                    <span className="data-label">Loading projection...</span>
                                )}
                            </div>
                        ) : (
                            <button className="button" style={{ alignSelf: 'flex-start', marginTop: 'var(--space-sm)' }} onClick={() => handleSelect(p.id)}>
                                Evaluate & Approve
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}


interface GovernanceState {
    pendingProposals: number;
    totalProposals: number;
    selfModQuarantined: boolean;
    recentVerdicts: number;
    constitutionHash: string;
}

export function GovernancePage() {
    const { t } = useTranslation();
    const [gov, setGov] = useState<GovernanceState | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            const posture = await api.getPosture();
            setGov({
                pendingProposals: posture.governance.pendingProposals,
                totalProposals: posture.governance.recentVerdicts + posture.governance.pendingProposals,
                selfModQuarantined: posture.governance.selfModQuarantined,
                recentVerdicts: posture.governance.recentVerdicts,
                constitutionHash: posture.identity.fingerprint.slice(0, 16),
            });
        } catch {
            setGov({
                pendingProposals: 0,
                totalProposals: 0,
                selfModQuarantined: false,
                recentVerdicts: 0,
                constitutionHash: 'N/A',
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const id = setInterval(fetchData, 30_000);
        return () => clearInterval(id);
    }, [fetchData]);

    if (loading) {
        return (
            <div>
                <header className="page-header">
                    <span className="page-label label">{t('nav.governance')}</span>
                    <h2 className="page-title">{t('governance.title')}</h2>
                </header>
                <div className="skeleton" style={{ height: 200, borderRadius: 10 }} />
            </div>
        );
    }

    const g = gov!;

    return (
        <div>
            <header className="page-header">
                <span className="page-label label">{t('nav.governance')}</span>
                <h2 className="page-title">{t('governance.title')}</h2>
                <p className="page-subtitle">{t('governance.subtitle')}</p>
            </header>

            <section className="overview-grid">
                {/* Self-Mod Status */}
                <div className="card">
                    <div className="card-header">
                        <div className={`card-icon ${g.selfModQuarantined ? 'rose' : 'green'}`}>
                            {g.selfModQuarantined ? <Lock /> : <Shield />}
                        </div>
                        <span className="card-title">{t('governance.selfModStatus')}</span>
                    </div>
                    <div className="data-grid">
                        <div className="data-item">
                            <span className="data-label">{t('governance.selfModStatus')}</span>
                            <span className="data-value">
                                <span className={`status-dot ${g.selfModQuarantined ? 'dead' : 'alive'}`} />
                                {g.selfModQuarantined ? t('presence.quarantined') : t('presence.active')}
                            </span>
                        </div>
                        <div className="data-item">
                            <span className="data-label">{t('governance.constitutionHash')}</span>
                            <code className="data-value info" style={{ fontSize: '0.8rem' }}>
                                {g.constitutionHash}
                            </code>
                        </div>
                    </div>
                </div>

                {/* Proposals */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-icon violet">
                            <FileText />
                        </div>
                        <span className="card-title">{t('governance.pendingProposals')}</span>
                    </div>
                    <div className="data-grid">
                        <div className="data-item">
                            <span className="data-label">{t('governance.pendingProposals')}</span>
                            <span className={`data-value ${g.pendingProposals > 0 ? 'warning' : 'positive'}`}>
                                {g.pendingProposals > 0 ? (
                                    <><AlertTriangle size={13} style={{ opacity: 0.7 }} /> {g.pendingProposals}</>
                                ) : (
                                    <><CheckCircle size={13} style={{ opacity: 0.7 }} /> 0</>
                                )}
                            </span>
                        </div>
                        <div className="data-item">
                            <span className="data-label">{t('governance.totalProposals')}</span>
                            <span className="data-value">{g.totalProposals}</span>
                        </div>
                        <div className="data-item">
                            <span className="data-label">{t('governance.recentVerdicts')}</span>
                            <span className="data-value">{g.recentVerdicts}</span>
                        </div>
                    </div>
                </div>
            </section>

            {g.pendingProposals === 0 && (
                <section className="overview-full" style={{ marginTop: 'var(--space-lg)' }}>
                    <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                        <CheckCircle size={32} style={{ opacity: 0.3, marginBottom: 'var(--space-sm)' }} />
                        <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem' }}>
                            {t('governance.noProposals')}
                        </p>
                    </div>
                </section>
            )}

            {g.pendingProposals > 0 && <ProposalInbox />}
        </div>
    );
}
