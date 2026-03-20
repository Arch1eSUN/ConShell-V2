import { type ReactNode } from 'react';
import {
    Eye,
    Terminal,
    ScrollText,
    ListTodo,
    Sparkles,
    Brain,
    Fingerprint,
    Shield,
    BarChart3,
    HeartPulse,
    Wallet,
    TrendingUp,
    Settings,
    Users,
    Cpu,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';
import './Layout.css';

export type Tab =
    | 'presence'
    | 'chat' | 'logs' | 'tasks' | 'skills' | 'memory'
    | 'identity' | 'governance'
    | 'economic' | 'metrics' | 'health'
    | 'collective'
    | 'wallet' | 'settings';

interface LayoutProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    connectionStatus?: string;
    agentName?: string;
    children: ReactNode;
}

interface NavItem {
    id: Tab;
    label: string;
    icon: React.ReactNode;
}

interface NavGroup {
    label: string;
    items: NavItem[];
}

const ICON_SIZE = 15;

/**
 * 6 Canonical Control Planes — V2 Information Architecture
 *
 * Presence   → 存在感知：首页、状态总览
 * Runtime    → 运行时：终端、日志、任务、技能、记忆
 * Governance → 治理：身份、自我修改、宪法
 * Survival   → 生存：经济、指标、健康
 * Collective → 集体：同伴网络、委派
 * Operator   → 操作员：钱包、设置
 */
const NAV_GROUPS: NavGroup[] = [
    {
        label: 'Presence',
        items: [
            { id: 'presence', label: 'Presence', icon: <Eye size={ICON_SIZE} /> },
        ],
    },
    {
        label: 'Runtime',
        items: [
            { id: 'chat', label: 'Terminal', icon: <Terminal size={ICON_SIZE} /> },
            { id: 'logs', label: 'Logs', icon: <ScrollText size={ICON_SIZE} /> },
            { id: 'tasks', label: 'Tasks', icon: <ListTodo size={ICON_SIZE} /> },
            { id: 'skills', label: 'Skills', icon: <Sparkles size={ICON_SIZE} /> },
            { id: 'memory', label: 'Memory', icon: <Brain size={ICON_SIZE} /> },
        ],
    },
    {
        label: 'Governance',
        items: [
            { id: 'identity', label: 'Identity', icon: <Fingerprint size={ICON_SIZE} /> },
            { id: 'governance', label: 'Constitution', icon: <Shield size={ICON_SIZE} /> },
        ],
    },
    {
        label: 'Survival',
        items: [
            { id: 'economic', label: 'Economic', icon: <TrendingUp size={ICON_SIZE} /> },
            { id: 'metrics', label: 'Metrics', icon: <BarChart3 size={ICON_SIZE} /> },
            { id: 'health', label: 'Health', icon: <HeartPulse size={ICON_SIZE} /> },
        ],
    },
    {
        label: 'Collective',
        items: [
            { id: 'collective', label: 'Network', icon: <Users size={ICON_SIZE} /> },
        ],
    },
    {
        label: 'Operator',
        items: [
            { id: 'wallet', label: 'Wallet', icon: <Wallet size={ICON_SIZE} /> },
            { id: 'settings', label: 'Settings', icon: <Settings size={ICON_SIZE} /> },
        ],
    },
];

export function Layout({ activeTab, onTabChange, connectionStatus, agentName, children }: LayoutProps) {
    const { t } = useTranslation();
    const connected = connectionStatus === 'connected';

    return (
        <div className="layout">
            {/* Sidebar */}
            <aside className="sidebar" role="navigation" aria-label="Main navigation">
                <div className="sidebar-brand">
                    <div className="sidebar-logo-mark">
                        <img src="/logo.png" alt="ConShell Logo" width="24" height="24" style={{ borderRadius: '4px' }} />
                    </div>
                    <div>
                        <h1 className="sidebar-logo">ConShell</h1>
                        <span className="sidebar-version">{t('common.version')}</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {NAV_GROUPS.map((group, gi) => (
                        <div className="sidebar-group" key={group.label}>
                            {gi > 0 && <div className="sidebar-divider" />}
                            <span className="sidebar-group-label">{t(`nav.groups.${group.label}`)}</span>
                            {group.items.map(tab => (
                                <button
                                    key={tab.id}
                                    className={`sidebar-item ${activeTab === tab.id ? 'active' : ''}`}
                                    onClick={() => onTabChange(tab.id)}
                                    aria-current={activeTab === tab.id ? 'page' : undefined}
                                >
                                    <span className="sidebar-item-icon">{tab.icon}</span>
                                    <span className="sidebar-item-label">{t(`nav.${tab.id}`)}</span>
                                </button>
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="flex flex-col gap-3">
                        <div className={`connection-badge ${connected ? 'online' : 'offline'}`}>
                            <span className="connection-dot" />
                            <span className="connection-text">
                                {connected ? t('common.connected') : t('common.offline')}
                            </span>
                        </div>
                        {agentName && (
                            <span className="sidebar-agent-name" title={agentName}>{agentName}</span>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main className="main-content" role="main">
                <div className="global-actions">
                    <ThemeToggle />
                    <LanguageToggle />
                </div>
                {children}
            </main>
        </div>
    );
}
