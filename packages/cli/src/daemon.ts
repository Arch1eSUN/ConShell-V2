/**
 * Daemon — 后台守护进程管理
 *
 * macOS: launchd plist
 * Linux: systemd service
 * 通用: spawn detached process
 */
import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync, spawn } from 'node:child_process';

// ── Types ─────────────────────────────────────────────────────────────

const PLIST_LABEL = 'ai.conshell.agent';
const SERVICE_NAME = 'conshell-agent';

// ── macOS launchd ─────────────────────────────────────────────────────

function getLaunchAgentDir(): string {
  return path.join(os.homedir(), 'Library', 'LaunchAgents');
}

function getPlistPath(): string {
  return path.join(getLaunchAgentDir(), `${PLIST_LABEL}.plist`);
}

function generatePlist(port: number): string {
  const conshellBin = process.argv[1] ?? 'conshell';
  const agentHome = process.env['CONSHELL_HOME'] ?? `${os.homedir()}/.conshell`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>${conshellBin}</string>
    <string>start</string>
    <string>-p</string>
    <string>${port}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${agentHome}/daemon.log</string>
  <key>StandardErrorPath</key>
  <string>${agentHome}/daemon.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CONSHELL_HOME</key>
    <string>${agentHome}</string>
    <key>NODE_ENV</key>
    <string>production</string>
  </dict>
</dict>
</plist>`;
}

// ── Linux systemd ─────────────────────────────────────────────────────

function getSystemdDir(): string {
  return path.join(os.homedir(), '.config', 'systemd', 'user');
}

function getServicePath(): string {
  return path.join(getSystemdDir(), `${SERVICE_NAME}.service`);
}

function generateServiceUnit(port: number): string {
  const conshellBin = process.argv[1] ?? 'conshell';
  const agentHome = process.env['CONSHELL_HOME'] ?? `${os.homedir()}/.conshell`;
  return `[Unit]
Description=ConShell AI Agent Daemon
After=network.target

[Service]
Type=simple
ExecStart=${process.execPath} ${conshellBin} start -p ${port}
Restart=always
RestartSec=10
Environment=CONSHELL_HOME=${agentHome}
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
`;
}

// ── Commands ──────────────────────────────────────────────────────────

export async function installDaemon(port = 4200): Promise<void> {
  const platform = os.platform();

  if (platform === 'darwin') {
    // macOS: launchd
    const dir = getLaunchAgentDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const plistPath = getPlistPath();
    fs.writeFileSync(plistPath, generatePlist(port));
    console.log(chalk.green(`✓ Installed launchd plist: ${plistPath}`));
    console.log(chalk.gray('  To start: launchctl load ' + plistPath));
    console.log(chalk.gray('  To stop:  launchctl unload ' + plistPath));
  } else if (platform === 'linux') {
    // Linux: systemd user service
    const dir = getSystemdDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const servicePath = getServicePath();
    fs.writeFileSync(servicePath, generateServiceUnit(port));
    console.log(chalk.green(`✓ Installed systemd service: ${servicePath}`));
    console.log(chalk.gray('  systemctl --user daemon-reload'));
    console.log(chalk.gray('  systemctl --user enable --now ' + SERVICE_NAME));
  } else {
    console.log(chalk.yellow(`⚠ Platform "${platform}" — use manual startup or 'conshell start' directly`));
  }
}

export async function uninstallDaemon(): Promise<void> {
  const platform = os.platform();

  if (platform === 'darwin') {
    const plistPath = getPlistPath();
    if (fs.existsSync(plistPath)) {
      try { execSync(`launchctl unload "${plistPath}" 2>/dev/null`); } catch { /* ok */ }
      fs.unlinkSync(plistPath);
      console.log(chalk.green('✓ Removed launchd plist'));
    } else {
      console.log(chalk.yellow('⚠ No plist found'));
    }
  } else if (platform === 'linux') {
    const servicePath = getServicePath();
    if (fs.existsSync(servicePath)) {
      try { execSync(`systemctl --user stop ${SERVICE_NAME} 2>/dev/null`); } catch { /* ok */ }
      try { execSync(`systemctl --user disable ${SERVICE_NAME} 2>/dev/null`); } catch { /* ok */ }
      fs.unlinkSync(servicePath);
      try { execSync('systemctl --user daemon-reload'); } catch { /* ok */ }
      console.log(chalk.green('✓ Removed systemd service'));
    } else {
      console.log(chalk.yellow('⚠ No service file found'));
    }
  }
}

export async function daemonStatus(): Promise<void> {
  const platform = os.platform();

  if (platform === 'darwin') {
    const plistPath = getPlistPath();
    if (!fs.existsSync(plistPath)) {
      console.log(chalk.yellow('Daemon not installed'));
      return;
    }
    try {
      const output = execSync(`launchctl list ${PLIST_LABEL} 2>&1`, { encoding: 'utf-8' });
      console.log(chalk.green('Daemon Status:'));
      console.log(output);
    } catch {
      console.log(chalk.yellow('Daemon installed but not running'));
    }
  } else if (platform === 'linux') {
    if (!fs.existsSync(getServicePath())) {
      console.log(chalk.yellow('Daemon not installed'));
      return;
    }
    try {
      const output = execSync(`systemctl --user status ${SERVICE_NAME} 2>&1`, { encoding: 'utf-8' });
      console.log(output);
    } catch (err: any) {
      console.log(err.stdout ?? chalk.yellow('Daemon not running'));
    }
  } else {
    console.log(chalk.gray(`Platform "${platform}" — daemon management not available`));
  }
}

export async function startBackground(port = 4200): Promise<void> {
  const conshellBin = process.argv[1] ?? 'conshell';
  const agentHome = process.env['CONSHELL_HOME'] ?? `${os.homedir()}/.conshell`;
  const logFile = path.join(agentHome, 'daemon.log');

  if (!fs.existsSync(agentHome)) fs.mkdirSync(agentHome, { recursive: true });

  const out = fs.openSync(logFile, 'a');
  const child = spawn(process.execPath, [conshellBin, 'start', '-p', String(port)], {
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, CONSHELL_HOME: agentHome, NODE_ENV: 'production' },
  });

  child.unref();
  console.log(chalk.green(`✓ ConShell started in background (PID: ${child.pid})`));
  console.log(chalk.gray(`  Logs: ${logFile}`));
  console.log(chalk.gray(`  Port: ${port}`));
}
