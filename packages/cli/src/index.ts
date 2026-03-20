#!/usr/bin/env node
/**
 * ConShell CLI — 🐢 Sovereign AI Agent Runtime
 *
 * Product-level CLI with 6 canonical control plane semantics.
 * Commands: start | status | tui | doctor | onboard | daemon | configure
 */
import { Command } from 'commander';
import { VERSION } from '@conshell/core/public';

const program = new Command()
  .name('conshell')
  .description('🐢 Sovereign AI Agent Runtime — Conway Automaton + OpenClaw')
  .version(VERSION);

// ── onboard ────────────────────────────────────────────────────────────
program
  .command('onboard')
  .description('Interactive first-run configuration wizard')
  .option('--install-daemon', 'Install background daemon after setup')
  .option('--defaults', 'Use defaults (non-interactive mode)')
  .option('--conshell-dir <path>', 'ConShell data directory')
  .action(async (opts) => {
    const { runOnboard } = await import('./onboard.js');
    await runOnboard({
      defaults: opts.defaults,
      installDaemon: opts.installDaemon,
      conshellDir: opts.conshellDir,
    });
  });

// ── start ──────────────────────────────────────────────────────────────
program
  .command('start')
  .description('Boot the runtime — starts API server + Dashboard')
  .option('-p, --port <port>', 'Port number', '4200')
  .action(async (opts) => {
    const chalk = (await import('chalk')).default;
    const { Kernel } = await import('@conshell/core/public');
    const port = parseInt(opts.port, 10);

    console.log(`${chalk.hex('#6C5CE7')('🐢')} Booting ConShell on port ${port}…`);

    const kernel = new Kernel();
    const result = await kernel.boot({ port } as any);

    if (!result.ok) {
      console.error(chalk.red(`✗ Boot failed at stage: ${result.failedAt}`));
      for (const s of result.stages.filter(s => !s.ok)) {
        console.error(chalk.red(`  ${s.stage}: ${s.error}`));
      }
      process.exit(1);
    }

    console.log(chalk.green(`✓ ConShell operational (${result.totalMs}ms)`));
    console.log(chalk.gray(`  Dashboard: http://localhost:${port}`));
    console.log(chalk.gray(`  API:       http://localhost:${port}/api`));
    console.log(chalk.gray(`  TUI:       conshell tui -p ${port}`));

    process.on('SIGINT', async () => {
      console.log(chalk.gray('\n🐢 Shutting down…'));
      await kernel.shutdown();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      await kernel.shutdown();
      process.exit(0);
    });
  });

// ── status ────────────────────────────────────────────────────────────
program
  .command('status')
  .description('Presence snapshot — quick runtime health check')
  .option('-p, --port <port>', 'Port number', '4200')
  .action(async (opts) => {
    const chalk = (await import('chalk')).default;
    const port = parseInt(opts.port, 10);
    const url = `http://localhost:${port}/api/system/summary`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(chalk.red(`✗ API returned ${res.status}`));
        process.exit(1);
      }

      const data = await res.json() as any;

      console.log('');
      console.log(chalk.hex('#6C5CE7')('🐢 ConShell — Presence Snapshot'));
      console.log(chalk.gray('━'.repeat(50)));

      // Agent presence
      if (data.agent) {
        const stateColor = data.agent.alive ? chalk.green : chalk.red;
        const beacon = data.agent.alive ? chalk.green('●') : chalk.red('✗');
        console.log(`  ${beacon} ${chalk.bold('State')}      ${stateColor(data.agent.state)}`);
      }

      // Health verdict
      if (data.posture && !data.posture.error) {
        const verdict = data.posture.healthVerdict ?? 'unknown';
        const vc = verdict === 'healthy' ? chalk.green
          : verdict === 'degraded' ? chalk.yellow
          : chalk.red;
        console.log(`  ${chalk.bold('  Health')}     ${vc(verdict)} (${data.posture.overallHealthScore ?? '?'}/100)`);
      }

      // Survival (Economic)
      if (data.economic && !data.economic.error) {
        const tier = data.economic.survivalTier ?? 'unknown';
        const tc = tier === 'thriving' || tier === 'normal' ? chalk.green
          : tier === 'survival' ? chalk.yellow : chalk.red;
        console.log(`  ${chalk.bold('  Survival')}   ${tc(tier.toUpperCase())} · runway ${data.economic.runwayDays ?? '?'}d`);
      }

      // Collective
      if (data.collective && !data.collective.error) {
        console.log(`  ${chalk.bold('  Collective')} ${data.collective.totalPeers ?? 0} peers · delegation ${Math.round((data.collective.delegationSuccessRate ?? 0) * 100)}%`);
      }

      // Governance
      if (data.governance && !data.governance.error) {
        const pend = data.governance.pendingProposals ?? 0;
        console.log(`  ${chalk.bold('  Governance')} ${pend === 0 ? chalk.green('clean') : chalk.yellow(`${pend} pending`)}`);
      }

      // Version + timestamp
      console.log(chalk.gray('━'.repeat(50)));
      console.log(chalk.gray(`  v${data.version ?? '?'} · ${data.timestamp ?? ''}`));
      console.log('');
    } catch {
      console.error(chalk.red(`✗ Cannot connect to ConShell at localhost:${port}`));
      console.error(chalk.gray('  Is ConShell running? Try: conshell start'));
      process.exit(1);
    }
  });

// ── tui ───────────────────────────────────────────────────────────────
program
  .command('tui')
  .description('Terminal dashboard — live 6-plane control view (press q to exit)')
  .option('-p, --port <port>', 'Port number', '4200')
  .action(async (opts) => {
    const { startTui } = await import('./tui.js');
    await startTui({ port: parseInt(opts.port, 10) });
  });

// ── doctor ─────────────────────────────────────────────────────────────
program
  .command('doctor')
  .description('System truth diagnostic — checks all 6 control planes')
  .action(async () => {
    const { runDoctor } = await import('./doctor.js');
    await runDoctor();
  });

// ── daemon ─────────────────────────────────────────────────────────────
const daemonCmd = program
  .command('daemon')
  .description('Background daemon management (install/uninstall/status)');

daemonCmd
  .command('install')
  .description('Install daemon (macOS launchd / Linux systemd)')
  .option('-p, --port <port>', 'Port number', '4200')
  .action(async (opts) => {
    const { installDaemon } = await import('./daemon.js');
    await installDaemon(parseInt(opts.port, 10));
  });

daemonCmd
  .command('uninstall')
  .description('Uninstall daemon')
  .action(async () => {
    const { uninstallDaemon } = await import('./daemon.js');
    await uninstallDaemon();
  });

daemonCmd
  .command('status')
  .description('Check daemon status')
  .action(async () => {
    const { daemonStatus } = await import('./daemon.js');
    await daemonStatus();
  });

daemonCmd
  .command('start-bg')
  .description('Start in background (without system service)')
  .option('-p, --port <port>', 'Port number', '4200')
  .action(async (opts) => {
    const { startBackground } = await import('./daemon.js');
    await startBackground(parseInt(opts.port, 10));
  });

// ── configure ──────────────────────────────────────────────────────────
program
  .command('configure')
  .description('Open configuration file in default editor')
  .action(async () => {
    const chalk = (await import('chalk')).default;
    const open = (await import('open')).default;
    const os = await import('node:os');
    const path = await import('node:path');
    const configPath = path.join(
      process.env['CONSHELL_HOME'] ?? `${os.homedir()}/.conshell`,
      'config.json',
    );
    console.log(chalk.gray(`Opening: ${configPath}`));
    await open(configPath);
  });

// ── Default: REPL ────────────────────────────────────────────────────
program
  .action(async () => {
    const chalk = (await import('chalk')).default;
    const { Kernel } = await import('@conshell/core/public');

    console.log(chalk.hex('#6C5CE7')('🐢') + ' Booting ConShell for REPL…');

    const kernel = new Kernel();
    const result = await kernel.boot();

    if (!result.ok) {
      console.error(chalk.red(`✗ Boot failed at: ${result.failedAt}`));
      process.exit(1);
    }

    const { startRepl } = await import('./repl.js');
    await startRepl(kernel);
  });

program.parse();
