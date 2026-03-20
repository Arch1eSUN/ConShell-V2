/**
 * SelfMod tests — SelfModManager + git versioning + rate limiting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SelfModManager, ProtectedFileError, SelfModRateLimitError } from '../selfmod/index.js';

const TEST_HOME = path.join(os.tmpdir(), `conshell-test-selfmod-${Date.now()}`);

describe('SelfMod', () => {
  let mgr: SelfModManager;

  beforeEach(() => {
    fs.mkdirSync(TEST_HOME, { recursive: true });
    mgr = new SelfModManager({
      agentHome: TEST_HOME,
      maxModsPerHour: 3,
      gitEnabled: false, // disable git for unit tests
      requireApproval: true,
    });
  });

  afterEach(() => {
    fs.rmSync(TEST_HOME, { recursive: true, force: true });
  });

  async function performMod(file: string, content: string, reason: string) {
    const rec = await mgr.propose(file, content, reason);
    mgr.approve(rec.id);
    return await mgr.apply(rec.id);
  }

  describe('modify', () => {
    it('should create a new file', async () => {
      const record = await performMod('test.txt', 'Hello World', 'test creation');
      expect(record.id).toMatch(/^mod_/);
      expect(record.file).toBe('test.txt');
      expect(record.reason).toBe('test creation');

      const filePath = path.join(TEST_HOME, 'test.txt');
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('Hello World');
    });

    it('should update an existing file with diff', async () => {
      const filePath = path.join(TEST_HOME, 'existing.txt');
      fs.writeFileSync(filePath, 'old content');

      const record = await performMod('existing.txt', 'new content', 'update');
      expect(record.diff).toContain('- old content');
      expect(record.diff).toContain('+ new content');
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('new content');
    });

    it('should record modification in history', async () => {
      await performMod('a.txt', 'aaa', 'first');
      await performMod('b.txt', 'bbb', 'second');

      const history = mgr.history();
      expect(history).toHaveLength(2);
      expect(history[0].file).toBe('a.txt');
      expect(history[1].file).toBe('b.txt');
    });

    it('should write audit log', async () => {
      await performMod('audit-test.txt', 'content', 'audit test');
      const auditPath = path.join(TEST_HOME, 'audit.jsonl');
      expect(fs.existsSync(auditPath)).toBe(true);
      const lines = fs.readFileSync(auditPath, 'utf-8').trim().split('\n');
      const entry = JSON.parse(lines[0]);
      expect(entry.file).toBe('audit-test.txt');
    });
  });

  describe('protected files', () => {
    it('should reject modification of constitution.md', async () => {
      await expect(mgr.propose('constitution.md', 'hacked', 'evil')).rejects.toThrow(ProtectedFileError);
    });

    it('should reject modification of SOUL.md', async () => {
      await expect(mgr.propose('SOUL.md', 'changed', 'override')).rejects.toThrow(ProtectedFileError);
    });
  });

  describe('rate limiting', () => {
    it('should allow modifications within limit', async () => {
      await performMod('f1.txt', 'a', 'mod 1');
      await performMod('f2.txt', 'b', 'mod 2');
      await performMod('f3.txt', 'c', 'mod 3');
      // 3 mods within limit of 3
      expect(mgr.stats().lastHour).toBe(3);
    });

    it('should reject when rate limit exceeded', async () => {
      await performMod('f1.txt', 'a', 'mod 1');
      await performMod('f2.txt', 'b', 'mod 2');
      await performMod('f3.txt', 'c', 'mod 3');
      // 4th should fail
      const rec = await mgr.propose('f4.txt', 'd', 'mod 4');
      mgr.approve(rec.id);
      await expect(mgr.apply(rec.id)).rejects.toThrow(SelfModRateLimitError);
    });
  });

  describe('stats', () => {
    it('should track modification stats', async () => {
      const stats0 = mgr.stats();
      expect(stats0.total).toBe(0);

      await performMod('s.txt', 'data', 'stat test');
      const stats1 = mgr.stats();
      expect(stats1.total).toBe(1);
      expect(stats1.lastHour).toBe(1);
      expect(stats1.rolledBack).toBe(0);
    });
  });

  describe('history filtering', () => {
    it('should filter by file', async () => {
      await performMod('keep.txt', 'keep', 'keep');
      await performMod('skip.txt', 'skip', 'skip');

      const filtered = mgr.history({ file: 'keep' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].file).toBe('keep.txt');
    });
  });
});
