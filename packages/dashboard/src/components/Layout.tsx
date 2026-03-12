/**
 * Layout — 侧边栏 + 主内容区
 */
import React from 'react';
import type { ReactNode } from 'react';

export type TabId =
  | 'overview'
  | 'chat'
  | 'logs'
  | 'identity'
  | 'metrics'
  | 'skills'
  | 'wallet'
  | 'settings'
  | 'health'
  | 'tasks'
  | 'memory';

interface NavItem {
  id: TabId;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview',  label: 'Overview',  icon: '🏠' },
  { id: 'chat',      label: 'Chat',      icon: '💬' },
  { id: 'identity',  label: 'Identity',  icon: '🐢' },
  { id: 'metrics',   label: 'Metrics',   icon: '📊' },
  { id: 'skills',    label: 'Skills',    icon: '⚡' },
  { id: 'tasks',     label: 'Tasks',     icon: '📋' },
  { id: 'memory',    label: 'Memory',    icon: '🧠' },
  { id: 'wallet',    label: 'Wallet',    icon: '💰' },
  { id: 'logs',      label: 'Logs',      icon: '📝' },
  { id: 'health',    label: 'Health',    icon: '🩺' },
  { id: 'settings',  label: 'Settings',  icon: '⚙️' },
];

interface LayoutProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  connectionStatus: string;
  agentName: string;
  children: ReactNode;
}

export function Layout({ activeTab, onTabChange, connectionStatus, agentName, children }: LayoutProps) {
  const statusColor = connectionStatus === 'connected' ? '#4ade80'
    : connectionStatus === 'connecting' ? '#facc15'
    : '#f87171';

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <span style={styles.brandIcon}>🐢</span>
          <div>
            <div style={styles.brandName}>{agentName}</div>
            <div style={styles.brandStatus}>
              <span style={{ ...styles.statusDot, backgroundColor: statusColor }} />
              {connectionStatus}
            </div>
          </div>
        </div>

        <nav style={styles.nav}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              style={{
                ...styles.navItem,
                ...(activeTab === item.id ? styles.navItemActive : {}),
              }}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={styles.footer}>
          <span style={styles.footerText}>ConShell V2</span>
        </div>
      </aside>

      {/* Main content */}
      <main style={styles.main}>
        {children}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    background: '#0a0a0f',
    color: '#e4e4e7',
    fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
  },
  sidebar: {
    width: 240,
    background: 'linear-gradient(180deg, #111118 0%, #0d0d12 100%)',
    borderRight: '1px solid #1e1e2e',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 0',
    flexShrink: 0,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0 20px 20px',
    borderBottom: '1px solid #1e1e2e',
    marginBottom: 8,
  },
  brandIcon: { fontSize: 28 },
  brandName: { fontWeight: 600, fontSize: 15, color: '#f4f4f5' },
  brandStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#71717a',
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    display: 'inline-block',
  },
  nav: {
    flex: 1,
    padding: '8px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    overflowY: 'auto',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    border: 'none',
    background: 'transparent',
    color: '#a1a1aa',
    fontSize: 14,
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'all 0.15s ease',
  },
  navItemActive: {
    background: 'rgba(108, 92, 231, 0.15)',
    color: '#a78bfa',
    fontWeight: 500,
  },
  navIcon: { fontSize: 16 },
  footer: {
    padding: '12px 20px',
    borderTop: '1px solid #1e1e2e',
    textAlign: 'center' as const,
  },
  footerText: { fontSize: 11, color: '#52525b' },
  main: {
    flex: 1,
    overflow: 'auto',
    padding: 32,
  },
};
