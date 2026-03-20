/**
 * App — ConShell V2 Dashboard
 *
 * 6 Canonical Control Planes:
 *   Presence / Runtime / Governance / Survival / Collective / Operator
 *
 * Round 19.7: Performance-optimized with React.lazy() route splitting
 * and deferred Web3 provider loading.
 */
import { useState, useEffect, lazy, Suspense } from 'react';
import './styles/index.css';

// Providers (lightweight — loaded eagerly)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeProvider';
import { Layout } from './components/Layout';
import { ConwayBackground } from './components/ConwayBackground';

// ── Only PresencePage is eagerly loaded (first paint) ──
import { PresencePage } from './pages/PresencePage';

// ── All other pages: React.lazy() route-level code splitting ──
const ChatPage = lazy(() => import('./pages/ChatPage').then(m => ({ default: m.ChatPage })));
const LogsPage = lazy(() => import('./pages/LogsPage').then(m => ({ default: m.LogsPage })));
const TasksPage = lazy(() => import('./pages/TasksPage').then(m => ({ default: m.TasksPage })));
const SkillsPage = lazy(() => import('./pages/SkillsPage').then(m => ({ default: m.SkillsPage })));
const MemoryPage = lazy(() => import('./pages/MemoryPage').then(m => ({ default: m.MemoryPage })));
const IdentityPage = lazy(() => import('./pages/IdentityPage').then(m => ({ default: m.IdentityPage })));
const GovernancePage = lazy(() => import('./pages/GovernancePage').then(m => ({ default: m.GovernancePage })));
const EconomicPage = lazy(() => import('./pages/EconomicPage').then(m => ({ default: m.EconomicPage })));
const MetricsPage = lazy(() => import('./pages/MetricsPage').then(m => ({ default: m.MetricsPage })));
const HealthPage = lazy(() => import('./pages/HealthPage').then(m => ({ default: m.HealthPage })));
const CollectivePage = lazy(() => import('./pages/CollectivePage').then(m => ({ default: m.CollectivePage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));

// ── Web3 pages: extra-heavy, only loaded when navigating to wallet ──
const WalletPage = lazy(() => import('./pages/WalletPage').then(m => ({ default: m.WalletPage })));

// ── Lazy Web3 Provider wrapper (only mounts when Wallet tab is active) ──
const Web3ProviderWrapper = lazy(() => import('./components/Web3Provider'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 10_000,
    },
  },
});

// ── Loading fallback ─────────────────────────────────────────────────
function PageLoading() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '60vh',
      opacity: 0.5,
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.85rem',
        color: 'var(--text-secondary)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🐢</div>
        Loading…
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('presence');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [agentName, setAgentName] = useState('ConShell Agent');

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function checkConnection() {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:4200'}/api/health`,
      );
      if (res.ok) {
        const data = await res.json();
        setConnectionStatus('connected');
        if (data.agent) setAgentName(data.agent);
      } else {
        setConnectionStatus('disconnected');
      }
    } catch {
      setConnectionStatus('disconnected');
    }
  }

  // Route active tab → page component (6 canonical control planes)
  function renderPage() {
    switch (activeTab) {
      // ── Presence (eager — first paint) ──
      case 'presence':    return <PresencePage />;
      // ── Runtime ──
      case 'chat':        return <ChatPage />;
      case 'logs':        return <LogsPage messages={[]} />;
      case 'tasks':       return <TasksPage />;
      case 'skills':      return <SkillsPage />;
      case 'memory':      return <MemoryPage />;
      // ── Governance ──
      case 'identity':    return <IdentityPage />;
      case 'governance':  return <GovernancePage />;
      // ── Survival ──
      case 'economic':    return <EconomicPage />;
      case 'metrics':     return <MetricsPage />;
      case 'health':      return <HealthPage />;
      // ── Collective ──
      case 'collective':  return <CollectivePage />;
      // ── Operator (Web3-heavy — wrapped in lazy provider) ──
      case 'wallet':
        return (
          <Suspense fallback={<PageLoading />}>
            <Web3ProviderWrapper>
              <WalletPage />
            </Web3ProviderWrapper>
          </Suspense>
        );
      case 'settings':    return <SettingsPage />;
      default:            return <PresencePage />;
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ConwayBackground />
        <Layout
          activeTab={activeTab}
          onTabChange={setActiveTab}
          connectionStatus={connectionStatus}
          agentName={agentName}
        >
          <Suspense fallback={<PageLoading />}>
            {renderPage()}
          </Suspense>
        </Layout>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
