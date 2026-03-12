/**
 * 内置工具: Shell命令执行
 * 通过PolicyEngine保护
 */
import { exec } from 'node:child_process';
import type { ToolHandler } from '../tool-executor.js';

/** Shell执行工具 (受限) */
export const shellExecTool: ToolHandler = {
  name: 'shell_exec',
  description: 'Execute a shell command and return stdout. Commands are restricted by PolicyEngine.',
  async execute(args) {
    const command = String(args['command'] ?? '');
    if (!command) return 'Error: command is required';

    const cwd = String(args['cwd'] ?? process.cwd());
    const timeoutMs = Number(args['timeout'] ?? 15000);

    // 基础安全检查 (PolicyEngine会做更细的检查)
    const BLOCKED = ['rm -rf /', 'mkfs', 'dd if=', ':(){', 'fork bomb'];
    for (const b of BLOCKED) {
      if (command.includes(b)) {
        return `Error: Command blocked for safety: contains "${b}"`;
      }
    }

    return new Promise<string>((resolve) => {
      exec(command, { cwd, timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          resolve(`Exit code: ${error.code ?? 1}\nstderr: ${stderr.slice(0, 2000)}\nstdout: ${stdout.slice(0, 2000)}`);
          return;
        }
        const output = stdout || stderr;
        resolve(output.slice(0, 4000));
      });
    });
  },
};

export const shellTools: ToolHandler[] = [shellExecTool];
