/**
 * TUI — ConShell Terminal Dashboard
 *
 * Real-time terminal-based control plane view.
 * Renders 6 canonical sections via ANSI/chalk:
 *   Presence / Runtime / Governance / Survival / Collective / Operator
 *
 * Round 19.7: Second-layer maturity — interactive keys, connection beacon,
 * agenda hint, and help overlay.
 *
 * Keys: q=exit  r=refresh  ?=help
 * Data sources: /api/system/summary + /api/posture
 * Auto-refreshes every 5 seconds.
 */
import chalk from 'chalk';

interface TuiConfig {
  port: number;
}

interface AgendaItem {
  task?: string;
  category?: string;
  priority?: number;
  scheduledFor?: string;
}

interface SystemSummary {
  version?: string;
  timestamp?: string;
  agent?: {
    state: string;
    alive: boolean;
    uptime?: number;
  };
  posture?: {
    healthVerdict?: string;
    overallHealthScore?: number;
    error?: string;
  };
  economic?: {
    survivalTier?: string;
    runwayDays?: number;
    balanceCents?: number;
    burnRateCentsPerDay?: number;
    profitabilityRatio?: number;
    error?: string;
  };
  collective?: {
    totalPeers?: number;
    trustedPeers?: number;
    degradedPeers?: number;
    delegationSuccessRate?: number;
    error?: string;
  };
  governance?: {
    pendingProposals?: number;
    totalProposals?: number;
    selfModQuarantined?: boolean;
    error?: string;
  };
  identity?: {
    mode?: string;
    chainValid?: boolean;
    fingerprint?: string;
    error?: string;
  };
  agenda?: {
    scheduled?: number;
    deferred?: number;
    nextItem?: AgendaItem;
    error?: string;
  };
}

// ── Box Drawing Characters ───────────────────────────────────────────
const BOX = {
  tl: '┌', tr: '┐', bl: '└', br: '┘',
  h: '─', v: '│',
  lt: '├', rt: '┤', tt: '┬', bt: '┴',
  cr: '┼',
};

const TITLE = chalk.hex('#6C5CE7');
const DIM = chalk.gray;
const GREEN = chalk.green;
const RED = chalk.red;
const YELLOW = chalk.yellow;
const CYAN = chalk.cyan;
const BOLD = chalk.bold;
const MONO = chalk.hex('#A78BFA');

// ── Helpers ──────────────────────────────────────────────────────────

function hline(width: number, left = BOX.lt, right = BOX.rt): string {
  return DIM(left + BOX.h.repeat(width - 2) + right);
}

function topline(width: number): string {
  return DIM(BOX.tl + BOX.h.repeat(width - 2) + BOX.tr);
}

function botline(width: number): string {
  return DIM(BOX.bl + BOX.h.repeat(width - 2) + BOX.br);
}

function padRow(label: string, value: string, width: number): string {
  const labelStr = `  ${label}`;
  const stripped = stripAnsi(labelStr) + stripAnsi(value);
  const pad = Math.max(2, width - stripped.length - 3);
  return DIM(BOX.v) + labelStr + ' '.repeat(pad) + value + ' ' + DIM(BOX.v);
}

function sectionHeader(title: string, width: number): string {
  const headerText = ` ${title} `;
  const remaining = width - headerText.length - 2;
  const left = Math.floor(remaining / 2);
  const right = remaining - left;
  return DIM(BOX.lt) + DIM(BOX.h.repeat(left)) + BOLD(TITLE(headerText)) + DIM(BOX.h.repeat(right)) + DIM(BOX.rt);
}

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function tierColor(tier: string): (s: string) => string {
  switch (tier) {
    case 'thriving': case 'normal': return GREEN;
    case 'survival': return YELLOW;
    case 'critical': case 'terminal': return RED;
    default: return DIM;
  }
}

function verdictColor(verdict: string): (s: string) => string {
  switch (verdict) {
    case 'healthy': return GREEN;
    case 'degraded': return YELLOW;
    case 'critical': case 'terminal': return RED;
    default: return DIM;
  }
}

// ── Help Overlay ─────────────────────────────────────────────────────

function renderHelp(): string {
  const W = Math.min(process.stdout.columns || 80, 80);
  const lines: string[] = [];

  lines.push('');
  lines.push(topline(W));
  const titleText = '🐢 ConShell TUI — Help';
  const titlePad = Math.max(0, W - stripAnsi(titleText).length - 4);
  lines.push(DIM(BOX.v) + ' ' + TITLE(BOLD(titleText)) + ' '.repeat(titlePad) + ' ' + DIM(BOX.v));
  lines.push(hline(W));
  lines.push(padRow('q / Ctrl+C', DIM('Exit TUI'), W));
  lines.push(padRow('r', DIM('Refresh immediately'), W));
  lines.push(padRow('?', DIM('Toggle this help'), W));
  lines.push(hline(W));
  lines.push(padRow('Auto-refresh', DIM('Every 5 seconds'), W));
  lines.push(padRow('Data source', CYAN('/api/system/summary'), W));
  lines.push(hline(W));
  lines.push(padRow(BOLD('Control Planes'), '', W));
  lines.push(padRow('  PRESENCE', DIM('Lifeform health & identity beacon'), W));
  lines.push(padRow('  RUNTIME', DIM('Execution state & agent process'), W));
  lines.push(padRow('  GOVERNANCE', DIM('Proposals, self-mod, identity chain'), W));
  lines.push(padRow('  SURVIVAL', DIM('Economic truth: tier, runway, burn'), W));
  lines.push(padRow('  COLLECTIVE', DIM('Peer network & delegation'), W));
  lines.push(padRow('  OPERATOR', DIM('Dashboard & API endpoints'), W));
  lines.push(botline(W));
  lines.push(DIM('  Press any key to return…'));
  lines.push('');

  return lines.join('\n');
}

// ── Render Function ──────────────────────────────────────────────────

function renderDashboard(data: SystemSummary, connected: boolean): string {
  const W = Math.min(process.stdout.columns || 80, 80);
  const lines: string[] = [];

  // Title + connection beacon
  lines.push('');
  lines.push(topline(W));
  const beacon = connected ? GREEN('● Connected') : RED('✗ Disconnected');
  const titleText = '🐢 ConShell TUI';
  const beaconLen = stripAnsi(beacon).length;
  const titleLen = stripAnsi(titleText).length;
  const titlePad = Math.max(1, W - titleLen - beaconLen - 5);
  lines.push(DIM(BOX.v) + ' ' + TITLE(BOLD(titleText)) + ' '.repeat(titlePad) + beacon + ' ' + DIM(BOX.v));
  lines.push(hline(W));

  // ── PRESENCE ───────────────────────────────────────────────────
  lines.push(sectionHeader('PRESENCE', W));

  const verdict = data.posture?.healthVerdict ?? 'unknown';
  const score = data.posture?.overallHealthScore ?? 0;
  const alive = data.agent?.alive ?? false;

  lines.push(padRow(
    'Status',
    alive
      ? GREEN(BOLD('● ALIVE')) + DIM(` (${verdict})`)
      : RED(BOLD('✗ DOWN')) + DIM(` (${verdict})`),
    W,
  ));
  lines.push(padRow('Health Score', verdictColor(verdict)(`${score}/100`), W));
  if (data.agent?.uptime) {
    lines.push(padRow('Uptime', DIM(formatUptime(data.agent.uptime)), W));
  }
  lines.push(padRow('Version', MONO(data.version ?? 'unknown'), W));

  // ── RUNTIME ────────────────────────────────────────────────────
  lines.push(sectionHeader('RUNTIME', W));
  const state = data.agent?.state ?? 'unknown';
  lines.push(padRow('State', alive ? GREEN(state) : RED(state), W));

  // Agenda view (if available)
  if (data.agenda && !data.agenda.error) {
    const scheduled = data.agenda.scheduled ?? 0;
    const deferred = data.agenda.deferred ?? 0;
    lines.push(padRow('Agenda', `${scheduled} scheduled, ${deferred} deferred`, W));
    if (data.agenda.nextItem?.task) {
      lines.push(padRow('Next', DIM(data.agenda.nextItem.task.slice(0, 40)), W));
    }
  }

  // ── GOVERNANCE ─────────────────────────────────────────────────
  lines.push(sectionHeader('GOVERNANCE', W));
  if (data.governance && !data.governance.error) {
    const pending = data.governance.pendingProposals ?? 0;
    const quarantined = data.governance.selfModQuarantined ?? false;
    lines.push(padRow(
      'Proposals',
      pending > 0 ? YELLOW(`${pending} pending`) : GREEN('0 pending'),
      W,
    ));
    lines.push(padRow(
      'Self-Mod',
      quarantined ? RED('QUARANTINED') : GREEN('active'),
      W,
    ));
  } else {
    lines.push(padRow('Status', DIM('no data'), W));
  }

  if (data.identity && !data.identity.error) {
    lines.push(padRow('Identity', CYAN(data.identity.mode ?? 'unknown'), W));
    lines.push(padRow(
      'Chain',
      data.identity.chainValid ? GREEN('valid') : RED('broken'),
      W,
    ));
    if (data.identity.fingerprint) {
      const fp = data.identity.fingerprint;
      lines.push(padRow('Fingerprint', MONO(`${fp.slice(0, 8)}…${fp.slice(-4)}`), W));
    }
  }

  // ── SURVIVAL ───────────────────────────────────────────────────
  lines.push(sectionHeader('SURVIVAL', W));
  if (data.economic && !data.economic.error) {
    const tier = data.economic.survivalTier ?? 'unknown';
    const balance = ((data.economic.balanceCents ?? 0) / 100).toFixed(2);
    const runway = data.economic.runwayDays ?? 0;
    const burn = ((data.economic.burnRateCentsPerDay ?? 0) / 100).toFixed(2);
    const profit = ((data.economic.profitabilityRatio ?? 0) * 100).toFixed(0);

    lines.push(padRow('Tier', tierColor(tier)(BOLD(tier.toUpperCase())), W));
    lines.push(padRow('Balance', BOLD(`${balance} USDC`), W));
    lines.push(padRow('Burn Rate', DIM(`${burn}/day`), W));
    lines.push(padRow(
      'Runway',
      runway > 30 ? GREEN(`${runway}d`) : runway > 7 ? YELLOW(`${runway}d`) : RED(`${runway}d`),
      W,
    ));
    lines.push(padRow(
      'Profitability',
      Number(profit) >= 0 ? GREEN(`${profit}%`) : RED(`${profit}%`),
      W,
    ));
  } else {
    lines.push(padRow('Status', DIM('no data'), W));
  }

  // ── COLLECTIVE ─────────────────────────────────────────────────
  lines.push(sectionHeader('COLLECTIVE', W));
  if (data.collective && !data.collective.error) {
    lines.push(padRow('Peers', `${data.collective.totalPeers ?? 0}`, W));
    lines.push(padRow('Trusted', GREEN(`${data.collective.trustedPeers ?? 0}`), W));
    const degraded = data.collective.degradedPeers ?? 0;
    lines.push(padRow(
      'Degraded',
      degraded === 0 ? GREEN('0') : RED(`${degraded}`),
      W,
    ));
    const delegation = ((data.collective.delegationSuccessRate ?? 0) * 100).toFixed(0);
    lines.push(padRow('Delegation', `${delegation}%`, W));
  } else {
    lines.push(padRow('Status', DIM('no peers'), W));
  }

  // ── OPERATOR ───────────────────────────────────────────────────
  lines.push(sectionHeader('OPERATOR', W));
  lines.push(padRow('Dashboard', CYAN(`http://localhost:${(data as any).__port ?? 4200}`), W));
  lines.push(padRow('API', CYAN(`http://localhost:${(data as any).__port ?? 4200}/api`), W));

  // Footer with key hints
  lines.push(botline(W));
  const ts = data.timestamp ?? new Date().toISOString();
  lines.push(DIM(`  ${ts}  │  `) + BOLD('q') + DIM(':exit  ') + BOLD('r') + DIM(':refresh  ') + BOLD('?') + DIM(':help'));
  lines.push('');

  return lines.join('\n');
}

// ── Main TUI Loop ────────────────────────────────────────────────────

export async function startTui(config: TuiConfig): Promise<void> {
  const { port } = config;
  const baseUrl = `http://localhost:${port}`;
  let running = true;
  let showHelp = false;
  let lastConnected = false;
  let refreshNow = false;

  // Enable raw mode for keypress detection
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (key: string) => {
      if (key === 'q' || key === '\u0003') {  // q or Ctrl+C
        running = false;
        process.stdin.setRawMode(false);
        console.clear();
        console.log(chalk.gray('👋 TUI exited'));
        process.exit(0);
      }
      if (key === '?') {
        showHelp = !showHelp;
        if (showHelp) {
          console.clear();
          console.log(renderHelp());
        } else {
          refreshNow = true;
        }
      }
      if (key === 'r') {
        refreshNow = true;
      }
      // Any key exits help
      if (showHelp && key !== '?') {
        showHelp = false;
        refreshNow = true;
      }
    });
  }

  async function fetchSummary(): Promise<SystemSummary> {
    try {
      const res = await fetch(`${baseUrl}/api/system/summary`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as SystemSummary;
      (data as any).__port = port;
      lastConnected = true;
      return data;
    } catch {
      lastConnected = false;
      return {
        version: 'unknown',
        timestamp: new Date().toISOString(),
        agent: { state: 'unreachable', alive: false },
      };
    }
  }

  // Initial render
  console.clear();
  console.log(chalk.gray('  Connecting to ConShell…'));

  while (running) {
    if (!showHelp) {
      const data = await fetchSummary();
      console.clear();
      console.log(renderDashboard(data, lastConnected));
    }

    // Wait with interrupt support for immediate refresh
    refreshNow = false;
    const waitEnd = Date.now() + 5000;
    while (Date.now() < waitEnd && running && !refreshNow) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
}
