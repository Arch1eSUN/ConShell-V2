/**
 * 内置工具: 文件系统操作
 * 路径保护 + 读/写/列表
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';
import type { ToolHandler } from '../tool-executor.js';

/** 路径安全检查 */
function safePath(inputPath: string, cwd: string): string {
  const resolved = isAbsolute(inputPath) ? inputPath : resolve(cwd, inputPath);

  // 禁止访问敏感路径
  const BLOCKED_PREFIXES = ['/etc/shadow', '/etc/passwd', '/root/.ssh'];
  for (const b of BLOCKED_PREFIXES) {
    if (resolved.startsWith(b)) {
      throw new Error(`Access denied: ${resolved}`);
    }
  }

  return resolved;
}

/** 文件读取 */
export const fileReadTool: ToolHandler = {
  name: 'file_read',
  description: 'Read the contents of a file. Returns the file content as text.',
  async execute(args) {
    const path = String(args['path'] ?? '');
    if (!path) return 'Error: path is required';

    try {
      const resolvedPath = safePath(path, process.cwd());
      if (!existsSync(resolvedPath)) return `Error: File not found: ${resolvedPath}`;

      const stats = statSync(resolvedPath);
      if (stats.size > 1024 * 1024) return 'Error: File too large (>1MB)';

      const content = readFileSync(resolvedPath, 'utf-8');
      return content.slice(0, 8000);
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

/** 文件写入 */
export const fileWriteTool: ToolHandler = {
  name: 'file_write',
  description: 'Write content to a file. Creates or overwrites the file.',
  async execute(args) {
    const path = String(args['path'] ?? '');
    const content = String(args['content'] ?? '');
    if (!path) return 'Error: path is required';

    try {
      const resolvedPath = safePath(path, process.cwd());
      writeFileSync(resolvedPath, content, 'utf-8');
      return `Written ${content.length} bytes to ${resolvedPath}`;
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

/** 目录列表 */
export const fileListTool: ToolHandler = {
  name: 'file_list',
  description: 'List files and directories at a given path.',
  async execute(args) {
    const path = String(args['path'] ?? '.');

    try {
      const resolvedPath = safePath(path, process.cwd());
      if (!existsSync(resolvedPath)) return `Error: Path not found: ${resolvedPath}`;

      const entries = readdirSync(resolvedPath);
      const details = entries.slice(0, 100).map(name => {
        try {
          const fullPath = join(resolvedPath, name);
          const s = statSync(fullPath);
          return `${s.isDirectory() ? '📁' : '📄'} ${name} (${s.size} bytes)`;
        } catch {
          return `❓ ${name}`;
        }
      });

      return `Directory: ${resolvedPath}\n${details.join('\n')}`;
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

export const filesystemTools: ToolHandler[] = [fileReadTool, fileWriteTool, fileListTool];
