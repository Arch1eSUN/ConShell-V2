/**
 * Onboarding — Lifeform Activation (First-Run Setup)
 *
 * Round 19.7: Canonical product language, 6 control plane semantics.
 *
 * First-run flow:
 * 1. Verify/create ~/.conshell data directory
 * 2. Generate default config.json
 * 3. Run core health diagnostics
 * 4. Display control plane activation summary
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface OnboardOptions {
  defaults?: boolean;
  installDaemon?: boolean;
  conshellDir?: string;
}

const DEFAULT_CONFIG = {
  port: 4200,
  authMode: 'none',
  inference: {
    provider: 'openai',
    model: 'gpt-4o-mini',
  },
  memory: {
    tier: 'local',
  },
  logLevel: 'info',
};

export async function runOnboard(options: OnboardOptions = {}): Promise<void> {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;

  const conshellDir = options.conshellDir ?? join(homedir(), '.conshell');

  console.log('');
  console.log(chalk.hex('#6C5CE7')('🐢 ConShell — Lifeform Activation'));
  console.log(chalk.gray('━'.repeat(50)));
  console.log(chalk.gray('  First-run setup for your sovereign AI runtime'));
  console.log('');

  // ── Step 1: Data directory (Presence foundation) ──────────────
  const dirSpinner = ora('Initializing data directory…').start();

  if (existsSync(conshellDir)) {
    dirSpinner.succeed(`Data directory exists: ${chalk.cyan(conshellDir)}`);
  } else {
    mkdirSync(conshellDir, { recursive: true });
    mkdirSync(join(conshellDir, 'data'), { recursive: true });
    mkdirSync(join(conshellDir, 'logs'), { recursive: true });
    dirSpinner.succeed(`Data directory created: ${chalk.cyan(conshellDir)}`);
  }

  // ── Step 2: Configuration (Runtime foundation) ────────────────
  const configPath = join(conshellDir, 'config.json');
  const configSpinner = ora('Checking runtime configuration…').start();

  if (existsSync(configPath)) {
    try {
      const existing = JSON.parse(readFileSync(configPath, 'utf-8'));
      configSpinner.succeed(`Configuration loaded (port: ${existing.port ?? 4200})`);
    } catch {
      configSpinner.warn('Configuration file corrupted — regenerating with defaults');
      writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');
    }
  } else {
    writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');
    configSpinner.succeed(`Default configuration generated: ${chalk.cyan(configPath)}`);

    if (!options.defaults) {
      console.log(chalk.gray(`  Tip: Edit ${configPath} to customize runtime settings`));
    }
  }

  // ── Step 3: Health diagnostics (Survival check) ───────────────
  console.log('');
  const doctorSpinner = ora('Running health diagnostics…').start();

  try {
    const { runDoctor } = await import('./doctor.js');
    doctorSpinner.stop();
    await runDoctor();
  } catch {
    doctorSpinner.warn('Diagnostics unavailable (run `conshell doctor` later to check)');
  }

  // ── Step 4: Daemon install (Operator autonomy) ────────────────
  if (options.installDaemon) {
    console.log('');
    const daemonSpinner = ora('Installing background daemon…').start();
    try {
      const { installDaemon } = await import('./daemon.js');
      daemonSpinner.stop();
      await installDaemon(DEFAULT_CONFIG.port);
    } catch {
      daemonSpinner.warn('Daemon installation failed (run `conshell daemon install` later)');
    }
  }

  // ── Step 5: Activation summary ────────────────────────────────
  console.log('');
  console.log(chalk.hex('#6C5CE7')('🐢 Lifeform Activated'));
  console.log(chalk.gray('━'.repeat(50)));
  console.log('');
  console.log(chalk.bold('Control Planes Ready:'));
  console.log(`  ${chalk.green('●')} ${chalk.bold('Presence')}     Lifeform health beacon`);
  console.log(`  ${chalk.green('●')} ${chalk.bold('Runtime')}      Execution engine & agent process`);
  console.log(`  ${chalk.green('●')} ${chalk.bold('Governance')}   Constitution & self-modification`);
  console.log(`  ${chalk.green('●')} ${chalk.bold('Survival')}     Economic truth & resource management`);
  console.log(`  ${chalk.green('●')} ${chalk.bold('Collective')}   Peer network & delegation`);
  console.log(`  ${chalk.green('●')} ${chalk.bold('Operator')}     Your dashboard & wallet`);
  console.log('');
  console.log(chalk.bold('Next Steps:'));
  console.log(`  ${chalk.cyan('conshell start')}          Launch runtime + dashboard`);
  console.log(`  ${chalk.cyan('conshell status')}         Presence snapshot`);
  console.log(`  ${chalk.cyan('conshell tui')}            Terminal control plane`);
  console.log(`  ${chalk.cyan('conshell doctor')}         System health diagnostics`);
  console.log(`  ${chalk.cyan('conshell configure')}      Edit configuration`);
  console.log(`  ${chalk.cyan('conshell daemon install')} Background autonomy`);
  console.log('');
  console.log(chalk.gray(`  Data:      ${conshellDir}`));
  console.log(chalk.gray(`  Dashboard: http://localhost:${DEFAULT_CONFIG.port}`));
  console.log('');
}
