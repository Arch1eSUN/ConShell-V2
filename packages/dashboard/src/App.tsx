/**
 * ConShell Dashboard — Main application entry.
 *
 * Wrapped with wagmi + RainbowKit providers for Web3 wallet integration.
 */

import React, { useState, useEffect } from 'react';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClientProvider } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/query-core';
import { wagmiConfig } from './web3/config';
import { Layout } from './components/Layout';
import { useWebSocket } from './api';
import { api } from './api';
import {
  OverviewPage,
  ChatPage,
  SettingsPage,
  MetricsPage,
  IdentityPage,
  LogsPage,
  HealthPage,
  SkillsPage,
  WalletPage,
  TasksPage,
  MemoryPage,
} from './pages';

import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

function AppInner() {
  const [activeTab, setActiveTab] = useState('overview');
  const [agentName, setAgentName] = useState('ConShell Agent');
  const { status: connectionStatus, messages: wsMessages } = useWebSocket();

  useEffect(() => {
    api.health().then(h => setAgentName(h.agent)).catch(() => {});
  }, []);

  const renderPage = () => {
    switch (activeTab) {
      case 'overview':   return <OverviewPage />;
      case 'chat':       return <ChatPage />;
      case 'logs':       return <LogsPage messages={wsMessages} />;
      case 'identity':   return <IdentityPage />;
      case 'metrics':    return <MetricsPage />;
      case 'skills':     return <SkillsPage />;
      case 'wallet':     return <WalletPage />;
      case 'settings':   return <SettingsPage />;
      case 'health':     return <HealthPage />;
      case 'tasks':      return <TasksPage />;
      case 'memory':     return <MemoryPage />;
      default:           return <OverviewPage />;
    }
  };

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      connectionStatus={connectionStatus}
      agentName={agentName}
    >
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#0066ff',
            accentColorForeground: 'white',
            borderRadius: 'medium',
            fontStack: 'system',
          })}
        >
          <AppInner />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
