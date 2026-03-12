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
    <div className="wallet-page">
      <h2>💰 钱包管理</h2>

      {/* ── 外部钱包连接 ─────────────────────────────── */}
      <section className="wallet-section">
        <h3>🦊 外部钱包</h3>
        <div className="connect-button-wrapper">
          <ConnectButton
            showBalance={true}
            chainStatus="icon"
            accountStatus="full"
          />
        </div>

        {isConnected && (
          <div className="wallet-details">
            <div className="wallet-info-row">
              <span className="label">地址</span>
              <code className="address">{address}</code>
            </div>
            <div className="wallet-info-row">
              <span className="label">链</span>
              <span>{chainId === 8453 ? 'Base' : chainId === 1 ? 'Ethereum' : `Chain ${chainId}`}</span>
            </div>
            {ethBalance && (
              <div className="wallet-info-row">
                <span className="label">ETH余额</span>
                <span>{Number(ethBalance.formatted).toFixed(6)} {ethBalance.symbol}</span>
              </div>
            )}
            <div className="wallet-info-row">
              <span className="label">同步状态</span>
              <span className={`sync-status sync-${syncStatus}`}>
                {syncing ? '⏳ 同步中...' : syncStatus === 'synced' ? '✅ 已同步' : syncStatus === 'error' ? '❌ 失败' : '⏸️ 待同步'}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ── Agent本地钱包 ──────────────────────────────── */}
      <section className="wallet-section">
        <h3>🤖 Agent钱包</h3>
        {agentWallet ? (
          <div className="wallet-details">
            <div className="wallet-info-row">
              <span className="label">地址</span>
              <code className="address">{agentWallet.address}</code>
            </div>

            {agentWallet.balances && (
              <>
                {agentWallet.balances.chains.map(chain => (
                  <div key={chain.chainName} className="chain-balance">
                    <h4>{chain.chainName}</h4>
                    <div className="wallet-info-row">
                      <span className="label">ETH</span>
                      <span>{chain.ethFormatted}</span>
                    </div>
                    <div className="wallet-info-row">
                      <span className="label">USDC</span>
                      <span>${chain.usdcFormatted}</span>
                    </div>
                  </div>
                ))}
                <div className="wallet-info-row total">
                  <span className="label">总USDC (cents)</span>
                  <span className="total-value">{agentWallet.balances.totalUsdcCents}</span>
                </div>
              </>
            )}

            {isConnected && agentWallet.address && (
              <button
                className="fund-button"
                onClick={() => {
                  // 跳转到对应链的USDC转账
                  window.open(`https://basescan.org/address/${agentWallet.address}`, '_blank');
                }}
              >
                💸 充值Agent (Base)
              </button>
            )}
          </div>
        ) : (
          <p className="info-text">Agent钱包加载中...</p>
        )}
      </section>

      {/* ── WalletConnect Sessions ─────────────────────── */}
      <section className="wallet-section">
        <h3>🔗 WalletConnect Sessions</h3>
        {wcSessions.length > 0 ? (
          <div className="sessions-list">
            {wcSessions.map(session => (
              <div key={session.id} className={`session-card ${session.active ? 'active' : 'inactive'}`}>
                <div className="wallet-info-row">
                  <span className="label">钱包</span>
                  <span>{session.peerWalletType}</span>
                </div>
                <div className="wallet-info-row">
                  <span className="label">地址</span>
                  <code className="address">{session.peerAddress}</code>
                </div>
                <div className="wallet-info-row">
                  <span className="label">状态</span>
                  <span className={session.active ? 'status-active' : 'status-inactive'}>
                    {session.active ? '🟢 活跃' : '🔴 已断开'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="info-text">暂无活跃 WalletConnect 连接</p>
        )}
      </section>

      <style>{`
        .wallet-page {
          padding: 1.5rem;
          max-width: 800px;
        }
        .wallet-page h2 {
          font-size: 1.5rem;
          margin-bottom: 1.5rem;
          color: var(--text-primary, #e0e0e0);
        }
        .wallet-section {
          background: var(--surface, rgba(30, 32, 44, 0.8));
          border: 1px solid var(--border, rgba(255,255,255,0.1));
          border-radius: 12px;
          padding: 1.25rem;
          margin-bottom: 1.25rem;
          backdrop-filter: blur(12px);
        }
        .wallet-section h3 {
          font-size: 1.1rem;
          margin-bottom: 1rem;
          color: var(--text-secondary, #b0b0b0);
        }
        .connect-button-wrapper {
          margin-bottom: 1rem;
        }
        .wallet-details {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .wallet-info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.4rem 0;
          border-bottom: 1px solid var(--border, rgba(255,255,255,0.05));
        }
        .wallet-info-row .label {
          color: var(--text-secondary, #888);
          font-size: 0.85rem;
        }
        .address {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.8rem;
          color: var(--accent, #58a6ff);
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .chain-balance {
          background: rgba(0,0,0,0.15);
          border-radius: 8px;
          padding: 0.75rem;
          margin-top: 0.5rem;
        }
        .chain-balance h4 {
          font-size: 0.9rem;
          margin-bottom: 0.5rem;
          color: var(--text-primary, #ccc);
        }
        .total {
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 2px solid var(--accent, #58a6ff);
        }
        .total-value {
          font-weight: 700;
          font-size: 1.1rem;
          color: var(--accent, #58a6ff);
        }
        .fund-button {
          margin-top: 1rem;
          padding: 0.6rem 1.2rem;
          background: linear-gradient(135deg, #0066ff, #0033cc);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .fund-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(0,102,255,0.3);
        }
        .sync-status {
          font-size: 0.85rem;
        }
        .sync-synced { color: #22c55e; }
        .sync-error { color: #ef4444; }
        .session-card {
          background: rgba(0,0,0,0.1);
          border-radius: 8px;
          padding: 0.75rem;
          margin-bottom: 0.5rem;
        }
        .session-card.active {
          border-left: 3px solid #22c55e;
        }
        .session-card.inactive {
          border-left: 3px solid #666;
          opacity: 0.6;
        }
        .status-active { color: #22c55e; }
        .status-inactive { color: #666; }
        .sessions-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .info-text {
          color: var(--text-secondary, #888);
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
