/**
 * 内置工具集成测试
 *
 * Tests for shell_exec, file_read, file_write, file_list, web_browse, http_request
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { shellExecTool } from './shell.js';
import { fileReadTool, fileWriteTool, fileListTool } from './filesystem.js';

const TEST_DIR = join(tmpdir(), `conshell-tool-test-${Date.now()}`);

describe('Built-in Tools', () => {
  // Setup test directory
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });

  describe('shell_exec', () => {
    it('should execute a simple command', async () => {
      const result = await shellExecTool.execute({ command: 'echo hello' });
      expect(result.trim()).toBe('hello');
    });

    it('should return error for empty command', async () => {
      const result = await shellExecTool.execute({});
      expect(result).toContain('Error: command is required');
    });

    it('should block dangerous commands', async () => {
      const result = await shellExecTool.execute({ command: 'rm -rf /' });
      expect(result).toContain('blocked for safety');
    });

    it('should handle failing commands gracefully', async () => {
      const result = await shellExecTool.execute({ command: 'false' });
      expect(result).toContain('Exit code');
    });

    it('should respect cwd', async () => {
      const result = await shellExecTool.execute({ command: 'pwd', cwd: '/tmp' });
      // /tmp may be a symlink to /private/tmp on macOS
      expect(result.trim()).toMatch(/\/tmp|\/private\/tmp/);
    });
  });

  describe('file_read', () => {
    it('should read a file', async () => {
      const testFile = join(TEST_DIR, 'test-read.txt');
      writeFileSync(testFile, 'Hello from test', 'utf-8');
      const result = await fileReadTool.execute({ path: testFile });
      expect(result).toBe('Hello from test');
    });

    it('should return error for missing file', async () => {
      const result = await fileReadTool.execute({ path: join(TEST_DIR, 'nonexistent.txt') });
      expect(result).toContain('File not found');
    });

    it('should return error for empty path', async () => {
      const result = await fileReadTool.execute({});
      expect(result).toContain('Error: path is required');
    });

    it('should block access to sensitive paths', async () => {
      const result = await fileReadTool.execute({ path: '/etc/shadow' });
      expect(result).toContain('Access denied');
    });
  });

  describe('file_write', () => {
    it('should write a file', async () => {
      const testFile = join(TEST_DIR, 'test-write.txt');
      const result = await fileWriteTool.execute({ path: testFile, content: 'Written content' });
      expect(result).toContain('Written');
      expect(readFileSync(testFile, 'utf-8')).toBe('Written content');
    });

    it('should return error for empty path', async () => {
      const result = await fileWriteTool.execute({ content: 'test' });
      expect(result).toContain('Error: path is required');
    });
  });

  describe('file_list', () => {
    it('should list directory contents', async () => {
      // Create some files
      writeFileSync(join(TEST_DIR, 'a.txt'), 'a');
      writeFileSync(join(TEST_DIR, 'b.txt'), 'b');
      const result = await fileListTool.execute({ path: TEST_DIR });
      expect(result).toContain('a.txt');
      expect(result).toContain('b.txt');
    });

    it('should return error for nonexistent path', async () => {
      const result = await fileListTool.execute({ path: join(TEST_DIR, 'no-such-dir') });
      expect(result).toContain('not found');
    });
  });

  // Cleanup
  it('cleanup test directory', () => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });
});
