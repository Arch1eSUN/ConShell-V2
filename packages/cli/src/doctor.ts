/**
 * Doctor — 健康检查命令
 *
 * 检查项:
 * 1. Node.js 版本 (≥20.x)
 * 2. 配置文件存在性
 * 3. SQLite 连接
 * 4. Provider 可达性
 * 5. 钱包状态
 * 6. 磁盘空间
 */
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// ── Types ─────────────────────────────────────────────────────────────

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  detail?: string;
}

// ── Checks ────────────────────────────────────────────────────────────

async function checkNodeVersion(): Promise<CheckResult> {
  const version = process.versions.node;
  const major = parseInt(version.split('.')[0]!, 10);
  if (major >= 20) {
    return { name: 'Node.js', status: 'pass', message: `v${version}` };
  }
  if (major >= 18) {
    return { name: 'Node.js', status: 'warn', message: `v${version} (recommend ≥20)` };
  }
  return { name: 'Node.js', status: 'fail', message: `v${version} (requires ≥18)` };
}

async function checkConfig(agentHome: string): Promise<CheckResult> {
  const configPath = path.join(agentHome, 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const keys = Object.keys(content);
      return { name: 'Config', status: 'pass', message: `${keys.length} fields`, detail: configPath };
    } catch {
      return { name: 'Config', status: 'warn', message: 'Invalid JSON', detail: configPath };
    }
  }
  return { name: 'Config', status: 'warn', message: 'Not found (will use defaults)', detail: configPath };
}

async function checkDatabase(agentHome: string): Promise<CheckResult> {
  const dbPath = path.join(agentHome, 'conshell.db');
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
    return { name: 'Database', status: 'pass', message: `${sizeMb} MB`, detail: dbPath };
  }
  return { name: 'Database', status: 'warn', message: 'Not created yet (will create on first boot)', detail: dbPath };
}

async function checkSoul(agentHome: string): Promise<CheckResult> {
  const soulPath = path.join(agentHome, 'SOUL.md');
  if (fs.existsSync(soulPath)) {
    const content = fs.readFileSync(soulPath, 'utf-8');
    const lines = content.split('\n').length;
    return { name: 'SOUL.md', status: 'pass', message: `${lines} lines`, detail: soulPath };
  }
  return { name: 'SOUL.md', status: 'warn', message: 'Not found (will create default on boot)' };
}

async function checkWallet(agentHome: string): Promise<CheckResult> {
  const walletPath = path.join(agentHome, 'wallet.json');
  if (fs.existsSync(walletPath)) {
    try {
      const content = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
      const addr = content.address ?? 'unknown';
      return { name: 'Wallet', status: 'pass', message: `${addr.slice(0, 10)}…`, detail: walletPath };
    } catch {
      return { name: 'Wallet', status: 'warn', message: 'Invalid format', detail: walletPath };
    }
  }
  return { name: 'Wallet', status: 'warn', message: 'Not created yet' };
}

async function checkDiskSpace(): Promise<CheckResult> {
  const home = os.homedir();
  try {
    const stats = fs.statfsSync(home);
    const freeGb = (stats.bfree * stats.bsize / (1024 ** 3)).toFixed(1);
    const totalGb = (stats.blocks * stats.bsize / (1024 ** 3)).toFixed(1);
    const pct = ((stats.bfree / stats.blocks) * 100).toFixed(0);
    if (Number(pct) < 5) {
      return { name: 'Disk', status: 'warn', message: `${freeGb}/${totalGb} GB free (${pct}%)` };
    }
    return { name: 'Disk', status: 'pass', message: `${freeGb}/${totalGb} GB free (${pct}%)` };
  } catch {
    return { name: 'Disk', status: 'warn', message: 'Could not check disk space' };
  }
}

async function checkEnvVars(): Promise<CheckResult> {
  const important = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_AI_KEY', 'DEEPSEEK_API_KEY'];
  const found = important.filter(k => process.env[k]);
  if (found.length === 0) {
    return { name: 'API Keys', status: 'warn', message: 'No API keys found in env (configure via onboard or config.json)' };
  }
  return { name: 'API Keys', status: 'pass', message: `${found.length} found: ${found.join(', ')}` };
}

async function checkProviderConnectivity(): Promise<CheckResult> {
  // Quick check: can we reach the Ollama default endpoint?
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('http://localhost:11434/api/tags', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json() as { models?: unknown[] };
      return { name: 'Ollama', status: 'pass', message: `Connected (${(data.models ?? []).length} models)` };
    }
    return { name: 'Ollama', status: 'warn', message: `HTTP ${res.status}` };
  } catch {
    return { name: 'Ollama', status: 'warn', message: 'Not running (optional — only needed for local inference)' };
  }
}

async function checkSkillsDir(agentHome: string): Promise<CheckResult> {
  const skillsDir = path.join(agentHome, 'skills');
  if (fs.existsSync(skillsDir)) {
    try {
      const entries = fs.readdirSync(skillsDir);
      return { name: 'Skills', status: 'pass', message: `${entries.length} skill(s) installed`, detail: skillsDir };
    } catch {
      return { name: 'Skills', status: 'warn', message: 'Cannot read skills dir', detail: skillsDir };
    }
  }
  return { name: 'Skills', status: 'pass', message: 'No skills installed (empty is fine)' };
}

// ── Main ──────────────────────────────────────────────────────────────

export async function runDoctor(): Promise<void> {
  const agentHome = process.env['CONSHELL_HOME'] ?? `${os.homedir()}/.conshell`;

  console.log(chalk.hex('#6C5CE7')('\n🩺 ConShell Doctor\n'));
  console.log(chalk.gray(`  Agent home: ${agentHome}\n`));

  const spinner = ora('Running health checks…').start();

  const results = await Promise.all([
    checkNodeVersion(),
    checkConfig(agentHome),
    checkDatabase(agentHome),
    checkSoul(agentHome),
    checkWallet(agentHome),
    checkEnvVars(),
    checkProviderConnectivity(),
    checkSkillsDir(agentHome),
    checkDiskSpace(),
  ]);

  spinner.stop();

  // Display results
  const icons = { pass: chalk.green('✓'), warn: chalk.yellow('⚠'), fail: chalk.red('✗') };
  for (const r of results) {
    const icon = icons[r.status];
    const name = r.name.padEnd(14);
    const msg = r.status === 'fail' ? chalk.red(r.message)
              : r.status === 'warn' ? chalk.yellow(r.message)
              : chalk.green(r.message);
    console.log(`  ${icon} ${chalk.bold(name)} ${msg}`);
    if (r.detail) console.log(`    ${chalk.gray(r.detail)}`);
  }

  const passes = results.filter(r => r.status === 'pass').length;
  const warns  = results.filter(r => r.status === 'warn').length;
  const fails  = results.filter(r => r.status === 'fail').length;

  console.log();
  if (fails > 0) {
    console.log(chalk.red(`  ✗ ${fails} check(s) failed — please fix before running ConShell`));
  } else if (warns > 0) {
    console.log(chalk.yellow(`  ⚠ ${passes} passed, ${warns} warning(s) — ConShell can run but some features may be limited`));
  } else {
    console.log(chalk.green(`  ✓ All ${passes} checks passed — ConShell is ready!`));
  }
  console.log();
}
