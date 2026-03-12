#!/usr/bin/env node
/**
 * ConShell CLI — 🐢 主权AI Agent运行时
 */
import { Command } from 'commander';
import { VERSION } from '@conshell/core';

const program = new Command()
  .name('conshell')
  .description('🐢 Sovereign AI Agent Runtime — Conway Automaton + OpenClaw')
  .version(VERSION);

// ── onboard ────────────────────────────────────────────────────────────
program
  .command('onboard')
  .description('首次配置向导')
  .option('--install-daemon', '安装后台守护进程')
  .option('--defaults', '使用默认配置（非交互模式）')
  .option('--conshell-dir <path>', 'ConShell数据目录')
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
  .description('启动服务器 + WebUI')
  .option('-p, --port <port>', '端口号', '4200')
  .action(async (opts) => {
    const chalk = (await import('chalk')).default;
    const { Kernel } = await import('@conshell/core');
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
    console.log(chalk.gray(`  CLIProxy:  http://localhost:${port}/v1`));

    // Keep alive
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

// ── doctor ─────────────────────────────────────────────────────────────
program
  .command('doctor')
  .description('健康检查')
  .action(async () => {
    const { runDoctor } = await import('./doctor.js');
    await runDoctor();
  });

// ── daemon ─────────────────────────────────────────────────────────────
const daemonCmd = program
  .command('daemon')
  .description('后台守护进程管理');

daemonCmd
  .command('install')
  .description('安装守护进程 (macOS launchd / Linux systemd)')
  .option('-p, --port <port>', '端口号', '4200')
  .action(async (opts) => {
    const { installDaemon } = await import('./daemon.js');
    await installDaemon(parseInt(opts.port, 10));
  });

daemonCmd
  .command('uninstall')
  .description('卸载守护进程')
  .action(async () => {
    const { uninstallDaemon } = await import('./daemon.js');
    await uninstallDaemon();
  });

daemonCmd
  .command('status')
  .description('查看守护进程状态')
  .action(async () => {
    const { daemonStatus } = await import('./daemon.js');
    await daemonStatus();
  });

daemonCmd
  .command('start-bg')
  .description('后台启动 (不使用系统服务)')
  .option('-p, --port <port>', '端口号', '4200')
  .action(async (opts) => {
    const { startBackground } = await import('./daemon.js');
    await startBackground(parseInt(opts.port, 10));
  });

// ── configure ──────────────────────────────────────────────────────────
program
  .command('configure')
  .description('编辑设置')
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

// ── 默认命令：REPL ────────────────────────────────────────────────────
program
  .action(async () => {
    const chalk = (await import('chalk')).default;
    const { Kernel } = await import('@conshell/core');

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
