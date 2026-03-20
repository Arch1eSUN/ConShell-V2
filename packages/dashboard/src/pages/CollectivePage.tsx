/**
 * CollectivePage — Peer Network & Swarm Coordination
 *
 * Displays peer connections, delegation rates,
 * active children, and collective health.
 */
import { useState, useEffect, useCallback } from 'react';
import {
    Users,
    CheckCircle,
    AlertTriangle,
    Zap,
    Link2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';

interface CollectiveState {
    totalPeers: number;
    trustedPeers: number;
    degradedPeers: number;
    delegationSuccessRate: number;
    activeChildren: number;
}

export function CollectivePage() {
    const { t } = useTranslation();
    const [collective, setCollective] = useState<CollectiveState | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            const posture = await api.getPosture();
            setCollective({
                totalPeers: posture.collective.totalPeers,
                trustedPeers: posture.collective.trustedPeers,
                degradedPeers: posture.collective.degradedPeers,
                delegationSuccessRate: posture.collective.delegationSuccessRate,
                activeChildren: posture.lineage.activeChildren,
            });
        } catch {
            setCollective({
                totalPeers: 0,
                trustedPeers: 0,
                degradedPeers: 0,
                delegationSuccessRate: 1.0,
                activeChildren: 0,
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
                    <span className="page-label label">{t('nav.collective')}</span>
                    <h2 className="page-title">{t('collective.title')}</h2>
                </header>
                <div className="skeleton" style={{ height: 200, borderRadius: 10 }} />
            </div>
        );
    }

    const c = collective!;

    return (
        <div>
            <header className="page-header">
                <span className="page-label label">{t('nav.collective')}</span>
                <h2 className="page-title">{t('collective.title')}</h2>
                <p className="page-subtitle">{t('collective.subtitle')}</p>
            </header>

            <section className="overview-grid">
                {/* Peer Network */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-icon blue">
                            <Users />
                        </div>
                        <span className="card-title">{t('collective.title')}</span>
                    </div>
                    <div className="data-grid">
                        <div className="data-item">
                            <span className="data-label">{t('collective.totalPeers')}</span>
                            <span className="data-value">
                                <Link2 size={13} style={{ opacity: 0.5 }} />
                                {c.totalPeers}
                            </span>
                        </div>
                        <div className="data-item">
                            <span className="data-label">{t('collective.trustedPeers')}</span>
                            <span className="data-value positive">{c.trustedPeers}</span>
                        </div>
                        <div className="data-item">
                            <span className="data-label">{t('collective.degradedPeers')}</span>
                            <span className={`data-value ${c.degradedPeers === 0 ? 'positive' : 'negative'}`}>
                                {c.degradedPeers === 0 ? (
                                    <><CheckCircle size={13} style={{ opacity: 0.7 }} /> 0</>
                                ) : (
                                    <><AlertTriangle size={13} style={{ opacity: 0.7 }} /> {c.degradedPeers}</>
                                )}
                            </span>
                        </div>
                        <div className="data-item">
                            <span className="data-label">{t('collective.delegationRate')}</span>
                            <span className={`data-value ${c.delegationSuccessRate >= 0.8 ? 'positive' : 'warning'}`}>
                                {(c.delegationSuccessRate * 100).toFixed(0)}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Children / Lineage */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-icon green">
                            <Zap />
                        </div>
                        <span className="card-title">{t('collective.activeChildren')}</span>
                    </div>
                    <div className="data-grid">
                        <div className="data-item">
                            <span className="data-label">{t('collective.activeChildren')}</span>
                            <span className="data-value positive">
                                <Zap size={13} style={{ opacity: 0.5 }} />
                                {c.activeChildren}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {c.totalPeers === 0 && (
                <section className="overview-full" style={{ marginTop: 'var(--space-lg)' }}>
                    <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                        <Users size={32} style={{ opacity: 0.3, marginBottom: 'var(--space-sm)' }} />
                        <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem' }}>
                            {t('collective.noPeers')}
                        </p>
                    </div>
                </section>
            )}
        </div>
    );
}
