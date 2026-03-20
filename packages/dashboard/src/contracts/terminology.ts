/**
 * ConShell V2 — Terminology Contract
 *
 * The single source of truth for all labels, display strings, and
 * semantic mappings used across WebUI, TUI, and CLI surfaces.
 *
 * Rules:
 * 1. NEVER hardcode display strings in components — import from here
 * 2. Changes here automatically propagate to all control surfaces
 * 3. Each entry maps a programmatic key → human-readable label
 */

// ── Health Verdict Mapping ────────────────────────────────────────────

export type HealthVerdict = 'healthy' | 'degraded' | 'critical' | 'terminal';

export const VERDICT_LABELS: Record<HealthVerdict, string> = {
  healthy:   'Operational',
  degraded:  'Degraded',
  critical:  'Critical',
  terminal:  'Terminal',
} as const;

export const VERDICT_COLORS: Record<HealthVerdict, string> = {
  healthy:   'var(--status-operational)',
  degraded:  'var(--status-degraded)',
  critical:  'var(--status-critical)',
  terminal:  'var(--status-critical)',
} as const;

export const VERDICT_BG: Record<HealthVerdict, string> = {
  healthy:   'var(--status-operational-bg)',
  degraded:  'var(--status-degraded-bg)',
  critical:  'var(--status-critical-bg)',
  terminal:  'var(--status-critical-bg)',
} as const;

export const VERDICT_CSS_CLASS: Record<HealthVerdict, string> = {
  healthy:   'status-badge--operational',
  degraded:  'status-badge--degraded',
  critical:  'status-badge--critical',
  terminal:  'status-badge--critical',
} as const;

// ── Control Plane Tabs ────────────────────────────────────────────────

export type ControlPlane =
  | 'presence'
  | 'runtime'
  | 'governance'
  | 'survival'
  | 'collective'
  | 'operator';

export interface NavGroupDef {
  id: ControlPlane;
  label: string;
  signalColor: string;
  pages: NavPageDef[];
}

export interface NavPageDef {
  id: string;
  label: string;
  /** SVG path for Lucide-style 18x18 icon (or a Unicode char for lightweight impl) */
  icon: string;
}

/**
 * The 6 control planes and their sub-pages.
 * This replaces the flat 12-tab V1 navigation.
 */
export const CONTROL_PLANES: NavGroupDef[] = [
  {
    id: 'presence',
    label: 'Presence',
    signalColor: 'var(--signal-presence)',
    pages: [
      { id: 'presence',  label: 'Presence',  icon: '◉' },
    ],
  },
  {
    id: 'runtime',
    label: 'Runtime',
    signalColor: 'var(--signal-runtime)',
    pages: [
      { id: 'metrics',  label: 'Metrics',  icon: '▤' },
      { id: 'skills',   label: 'Skills',   icon: '⚡' },
      { id: 'tasks',    label: 'Tasks',    icon: '☰' },
      { id: 'memory',   label: 'Memory',   icon: '◫' },
    ],
  },
  {
    id: 'governance',
    label: 'Governance',
    signalColor: 'var(--signal-governance)',
    pages: [
      { id: 'identity',  label: 'Identity',  icon: '◈' },
    ],
  },
  {
    id: 'survival',
    label: 'Survival',
    signalColor: 'var(--signal-survival)',
    pages: [
      { id: 'economic',  label: 'Economic',  icon: '◆' },
      { id: 'wallet',    label: 'Wallet',    icon: '⬡' },
    ],
  },
  {
    id: 'collective',
    label: 'Collective',
    signalColor: 'var(--signal-collective)',
    pages: [],
  },
  {
    id: 'operator',
    label: 'Operator',
    signalColor: 'var(--text-muted)',
    pages: [
      { id: 'chat',      label: 'Chat',      icon: '▸' },
      { id: 'logs',      label: 'Logs',      icon: '▥' },
      { id: 'health',    label: 'Doctor',    icon: '✚' },
      { id: 'settings',  label: 'Settings',  icon: '⚙' },
    ],
  },
];

// ── Dimension Labels ──────────────────────────────────────────────────

export type TruthDimension =
  | 'identity'
  | 'runtime'
  | 'survival'
  | 'governance'
  | 'collective';

export const DIMENSION_LABELS: Record<TruthDimension, string> = {
  identity:    'Identity',
  runtime:     'Runtime',
  survival:    'Survival',
  governance:  'Governance',
  collective:  'Collective',
} as const;

export const DIMENSION_COLORS: Record<TruthDimension, string> = {
  identity:    'var(--signal-presence)',
  runtime:     'var(--signal-runtime)',
  survival:    'var(--signal-survival)',
  governance:  'var(--signal-governance)',
  collective:  'var(--signal-collective)',
} as const;

// ── Survival Tier Mapping ─────────────────────────────────────────────

export type SurvivalTier =
  | 'thriving' | 'sustainable' | 'cautious'
  | 'austerity' | 'critical' | 'terminal' | 'dead';

export const TIER_LABELS: Record<SurvivalTier, string> = {
  thriving:     'Thriving',
  sustainable:  'Sustainable',
  cautious:     'Cautious',
  austerity:    'Austerity',
  critical:     'Critical',
  terminal:     'Terminal',
  dead:         'Dead',
} as const;

// ── Intervention Types ────────────────────────────────────────────────

export type InterventionSeverity = 'info' | 'warning' | 'critical';

export const SEVERITY_COLORS: Record<InterventionSeverity, string> = {
  info:       'var(--signal-runtime)',
  warning:    'var(--signal-survival)',
  critical:   'var(--status-critical)',
} as const;

// ── Format Helpers ────────────────────────────────────────────────────

export function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

export function formatRunway(days: number): string {
  if (days >= 30) return `${Math.round(days)}d`;
  return `${days.toFixed(1)}d`;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatScore(score: number): string {
  return `${Math.round(score)}`;
}
