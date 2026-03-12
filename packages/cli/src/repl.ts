/**
 * REPL — 增强版交互终端
 *
 * 功能:
 * - readline接口 + 彩色提示符
 * - /help /clear /exit /status /soul 内置命令
 * - AgentLoop流式输出
 * - 上下文会话管理
 */
import * as readline from 'node:readline';
import chalk from 'chalk';
import type { Kernel } from '@conshell/core/public';

// ── 内置命令 ─────────────────────────────────────────────────────────

const COMMANDS: Record<string, { help: string; handler: (kernel: Kernel, args: string) => Promise<boolean> }> = {
  '/help': {
    help: '显示帮助',
    handler: async () => {
      console.log(chalk.cyan('\n  ConShell REPL Commands:\n'));
      for (const [cmd, { help }] of Object.entries(COMMANDS)) {
        console.log(`  ${chalk.yellow(cmd.padEnd(14))} ${help}`);
      }
      console.log();
      return true;
    },
  },
  '/clear': {
    help: '清屏',
    handler: async () => {
      console.clear();
      return true;
    },
  },
  '/exit': {
    help: '退出',
    handler: async () => false,
  },
  '/quit': {
    help: '退出',
    handler: async () => false,
  },
  '/status': {
    help: '显示Agent状态',
    handler: async (kernel) => {
      const svc = kernel.svc;
      const sm = svc.stateMachine;
      const inf = svc.inference.stats();
      console.log(chalk.cyan('\n  Agent Status:'));
      console.log(`  State:     ${chalk.green(sm.state)}`);
      console.log(`  Providers: ${inf.providerCount}`);
      console.log(`  Requests:  ${inf.requestCount}`);
      console.log(`  Cost:      ${inf.totalCost}¢`);
      console.log(`  Tools:     ${svc.toolExecutor.stats().registeredTools}`);
      console.log(`  Skills:    ${svc.skills.stats().total}`);
      console.log();
      return true;
    },
  },
  '/soul': {
    help: '显示SOUL信息',
    handler: async (kernel) => {
      const soul = kernel.svc.soul;
      const current = soul.current;
      console.log(chalk.cyan('\n  Soul Identity:'));
      console.log(`  Name:    ${chalk.bold(current.name)}`);
      console.log(`  Tagline: ${current.tagline ?? 'N/A'}`);
      console.log(`  Style:   ${current.communicationStyle ?? 'N/A'}`);
      console.log();
      return true;
    },
  },
  '/memory': {
    help: '显示记忆统计',
    handler: async (kernel) => {
      const mem = kernel.svc.memory;
      const stats = mem.stats();
      console.log(chalk.cyan('\n  Memory Stats:'));
      console.log(`  Hot Buffer: ${stats.hotSize} entries`);
      console.log(`  Soul Vers:  ${stats.soulVersions} versions`);
      console.log();
      return true;
    },
  },
  '/model': {
    help: '显示当前模型',
    handler: async (kernel) => {
      const inf = kernel.svc.inference;
      const stats = inf.stats();
      console.log(chalk.cyan('\n  Model Info:'));
      console.log(`  Primary:  ${stats.primaryProvider ?? 'none'}`);
      console.log(`  Tier:     ${stats.survivalTier}`);
      console.log();
      return true;
    },
  },
};

// ── REPL 主函数 ──────────────────────────────────────────────────────

export async function startRepl(kernel: Kernel): Promise<void> {
  const agent = kernel.svc.soul.current.name ?? 'ConShell';

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.hex('#6C5CE7')(`${agent} ❯ `),
    terminal: true,
    historySize: 100,
  });

  console.log(
    chalk.hex('#6C5CE7')(`\n🐢 ${agent}`) +
    chalk.gray(' — Sovereign AI Agent | Type /help for commands\n'),
  );
  rl.prompt();

  // 正在处理标记
  let processing = false;

  rl.on('line', async (line: string) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    // 内置命令
    if (input.startsWith('/')) {
      const [cmd, ...rest] = input.split(' ');
      const command = COMMANDS[cmd!];
      if (command) {
        const shouldContinue = await command.handler(kernel, rest.join(' '));
        if (!shouldContinue) {
          console.log(chalk.gray('👋 Goodbye'));
          rl.close();
          return;
        }
        rl.prompt();
        return;
      }
      console.log(chalk.red(`Unknown command: ${cmd}. Type /help for help.`));
      rl.prompt();
      return;
    }

    // 发送给 AgentLoop
    if (processing) {
      console.log(chalk.yellow('⏳ Still processing previous message…'));
      rl.prompt();
      return;
    }

    processing = true;
    try {
      const agentLoop = kernel.svc.agentLoop;
      process.stdout.write(chalk.green('\n'));

      // 同步调用 processMessage
      const response = await agentLoop.processMessage(input);

      if (response) {
        process.stdout.write(response);
        process.stdout.write('\n\n');
      } else {
        console.log(chalk.gray('(no response)'));
      }
    } catch (err) {
      console.error(chalk.red(`\nError: ${err instanceof Error ? err.message : String(err)}\n`));
    } finally {
      processing = false;
      rl.prompt();
    }
  });

  rl.on('close', () => {
    console.log();
    process.exit(0);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.gray('\n👋 Shutting down…'));
    kernel.shutdown().then(() => process.exit(0));
  });
}
