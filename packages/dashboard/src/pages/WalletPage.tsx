/**
 * WalletPage — Web3钱包管理页面
 *
 * 功能:
 *  1. RainbowKit ConnectButton 连接外部钱包
 *  2. Agent本地钱包信息
 *  3. 链上余额显示 (ETH + USDC, Base + Ethereum)
 *  4. 充值Agent入口
 *  5. WalletConnect Sessions管理
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useBalance, useChainId, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet, Bot, Link2, CheckCircle2, XCircle, Clock, Activity, CreditCard, ExternalLink, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';

// ── Types ──────────────────────────────────────────────────────────────

interface AgentWalletInfo {
  address: string;
  chain: string;
  balances?: {
    chains: Array<{
      chainName: string;
      ethFormatted: string;
      usdcFormatted: string;
      usdcCents: number;
    }>;
    totalUsdcCents: number;
  };
}

interface WCSession {
  id: string;
  peerAddress: string;
  peerWalletType: string;
  active: boolean;
  expiresAt: string;
}

// ── WalletPage ────────────────────────────────────────────────────────

export function WalletPage() {
  const { t } = useTranslation();
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { data: ethBalance } = useBalance({ address });

  const [agentWallet, setAgentWallet] = useState<AgentWalletInfo | null>(null);
  const [wcSessions, setWcSessions] = useState<WCSession[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'synced' | 'error'>('idle');

  // 加载Agent钱包信息
  useEffect(() => {
    api.rawRequest<AgentWalletInfo>('/api/wallet/info')
      .then(setAgentWallet)
      .catch(() => {});

    api.rawRequest<WCSession[]>('/api/wallet/sessions')
      .then(setWcSessions)
      .catch(() => {});
  }, []);

  // 外部钱包连接后同步到Agent后端
  const syncWalletToAgent = useCallback(async () => {
    if (!isConnected || !address) return;
    setSyncing(true);
    try {
      await api.rawRequest('/api/wallet/sync-external', {
        method: 'POST',
        body: JSON.stringify({
          address,
          chainId,
          walletType: connector?.name?.toLowerCase() ?? 'injected',
          connected: true,
        }),
      });
      setSyncStatus('synced');
    } catch {
      setSyncStatus('error');
    } finally {
      setSyncing(false);
    }
  }, [address, chainId, connector, isConnected]);

  useEffect(() => {
    if (isConnected && address) {
      syncWalletToAgent();
    }
  }, [isConnected, address, syncWalletToAgent]);

  return (
    <div>
      <header className="page-header">
        <span className="page-label label">{t('nav.wallet')}</span>
        <h2 className="page-title">{t('wallet.title')}</h2>
        <p className="page-subtitle">{t('wallet.subtitle')}</p>
      </header>

      <div style={{ display: 'grid', gap: 'var(--space-lg)', maxWidth: 800 }}>
        
        {/* ── 外部钱包 ─────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-icon amber"><Wallet size={16} /></div>
            <span className="card-title">{t('wallet.external')}</span>
          </div>
          
          <div style={{ padding: '0 0 16px', borderBottom: '1px dashed var(--border)', marginBottom: 16 }}>
            <ConnectButton.Custom>
              {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
                const ready = mounted;
                const connected = ready && account && chain;
                return (
                  <div {...(!ready && { 'aria-hidden': true, style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' } })}>
                    {(() => {
                      if (!connected) {
                        return (
                          <button onClick={openConnectModal} type="button" className="btn btn-primary" style={{ width: '100%' }}>
                            <Wallet size={16} /> {t('wallet.external')} {/* Or "Connect Wallet" */}
                          </button>
                        );
                      }
                      if (chain.unsupported) {
                        return (
                          <button onClick={openChainModal} type="button" className="btn" style={{ width: '100%', color: 'var(--rose)', borderColor: 'var(--rose)' }}>
                            <XCircle size={16} /> Wrong network
                          </button>
                        );
                      }
                      return (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button onClick={openChainModal} style={{ display: 'flex', alignItems: 'center', gap: 6 }} type="button" className="btn">
                            {chain.hasIcon && (
                              <div style={{ background: chain.iconBackground, width: 16, height: 16, borderRadius: 999, overflow: 'hidden' }}>
                                {chain.iconUrl && <img alt={chain.name ?? 'Chain icon'} src={chain.iconUrl} style={{ width: 16, height: 16 }} />}
                              </div>
                            )}
                            {chain.name}
                          </button>
                          <button onClick={openAccountModal} type="button" className="btn" style={{ flex: 1, justifyContent: 'center' }}>
                            {account.displayBalance ? ` ${account.displayBalance} · ` : ''} {account.displayName}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                );
              }}
            </ConnectButton.Custom>
          </div>

          {isConnected && (
            <div className="data-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
              <div className="data-item">
                <span className="data-label" style={{ marginBottom: 4 }}>{t('wallet.address')}</span>
                <span className="data-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, wordBreak: 'break-all' }}>{address}</span>
              </div>
              <div className="data-item">
                <span className="data-label" style={{ marginBottom: 4 }}>{t('wallet.network')}</span>
                <span className="data-value">{chainId === 8453 ? 'Base' : chainId === 1 ? 'Ethereum' : `Chain ${chainId}`}</span>
              </div>
              {ethBalance && (
                <div className="data-item">
                  <span className="data-label" style={{ marginBottom: 4 }}>{t('wallet.ethBalance')}</span>
                  <span className="data-value">{Number(ethBalance.formatted).toFixed(6)} {ethBalance.symbol}</span>
                </div>
              )}
              <div className="data-item">
                <span className="data-label" style={{ marginBottom: 4 }}>{t('wallet.syncStatus')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  {syncing ? (
                    <span className="badge badge-amber"><Clock size={12} className="spinning" style={{ marginRight: 4 }}/> {t('wallet.syncing')}</span>
                  ) : syncStatus === 'synced' ? (
                    <span className="badge badge-green"><CheckCircle2 size={12} style={{ marginRight: 4 }}/> {t('wallet.synced')}</span>
                  ) : syncStatus === 'error' ? (
                    <span className="badge badge-rose"><XCircle size={12} style={{ marginRight: 4 }}/> {t('wallet.syncFailed')}</span>
                  ) : (
                    <span className="badge"><Clock size={12} style={{ marginRight: 4 }}/> {t('wallet.pendingSync')}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Agent钱包 ──────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-icon blue"><Bot size={16} /></div>
            <span className="card-title">{t('wallet.agent')}</span>
          </div>

          {agentWallet ? (
            <div className="data-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="data-item">
                <span className="data-label" style={{ marginBottom: 4 }}>{t('wallet.address')}</span>
                <span className="data-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, wordBreak: 'break-all' }}>{agentWallet.address}</span>
              </div>

              {agentWallet.balances && (
                <>
                  <div style={{ marginTop: 8 }}>
                    {agentWallet.balances.chains.map(chain => (
                      <div key={chain.chainName} style={{ 
                        background: 'var(--surface-alt)', 
                        padding: '12px 16px', 
                        borderRadius: 8, 
                        marginBottom: 8,
                        border: '1px solid var(--border)'
                      }}>
                        <div style={{ fontWeight: 500, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ShieldCheck size={14} style={{ color: 'var(--blue)' }}/>
                          {chain.chainName}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          <div>
                            <span className="data-label" style={{ fontSize: 11, marginBottom: 4 }}>ETH</span>
                            <div className="data-value">{chain.ethFormatted}</div>
                          </div>
                          <div>
                            <span className="data-label" style={{ fontSize: 11, marginBottom: 4 }}>USDC</span>
                            <div className="data-value">${chain.usdcFormatted}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="data-item" style={{ 
                    marginTop: 8, 
                    paddingTop: 16, 
                    borderTop: '2px dashed var(--border)' 
                  }}>
                    <span className="data-label" style={{ marginBottom: 4 }}>{t('wallet.totalUsdc')}</span>
                    <span className="big-number" style={{ color: 'var(--blue)', fontSize: 24 }}>
                      {agentWallet.balances.totalUsdcCents}
                    </span>
                  </div>
                </>
              )}

              {isConnected && agentWallet.address && (
                <button
                  className="btn btn-primary"
                  onClick={() => window.open(`https://basescan.org/address/${agentWallet.address}`, '_blank')}
                  style={{ marginTop: 16, width: '100%' }}
                >
                  <CreditCard size={16} /> {t('wallet.depositAgent')} (Base) <ExternalLink size={14} />
                </button>
              )}
            </div>
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-muted)' }}>
              <Bot size={24} className="spinning" style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <div>{t('wallet.agentLoading')}</div>
            </div>
          )}
        </div>

        {/* ── WalletConnect Sessions ─────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-icon green"><Link2 size={16} /></div>
            <span className="card-title">{t('wallet.wcSessions')}</span>
          </div>

          {wcSessions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {wcSessions.map(session => (
                <div key={session.id} style={{ 
                  padding: 16, 
                  border: '1px solid var(--border)', 
                  borderRadius: 8,
                  borderLeft: `3px solid ${session.active ? 'var(--green)' : 'var(--border-strong)'}`,
                  background: 'var(--surface-alt)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontWeight: 500, color: 'var(--ink)' }}>{session.peerWalletType}</div>
                    <span className={`badge ${session.active ? 'badge-green' : 'badge-slate'}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {session.active ? (
                        <><Activity size={12} /> {t('wallet.active')}</>
                      ) : (
                        <><XCircle size={12} /> {t('wallet.disconnected')}</>
                      )}
                    </span>
                  </div>
                  <div className="data-item">
                    <span className="data-label" style={{ marginBottom: 4 }}>{t('wallet.address')}</span>
                    <span className="data-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, wordBreak: 'break-all' }}>
                      {session.peerAddress}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-muted)' }}>
              <Link2 size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <div>{t('wallet.noWcSessions')}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
