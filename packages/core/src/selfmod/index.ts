/**
 * SelfMod — 自修改管理 + Git版本控制 + 审计日志
 *
 * Based on Conway Automaton self-modification:
 * - Every modification is audit-logged and git-versioned in ~/.conshell/
 * - Protected files (constitution, core laws) cannot be modified
 * - Rate limits prevent runaway self-modification
 * - Creator has full audit rights to every change
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { isProtectedFile } from '../constitution/index.js';
import type { Logger } from '../types/common.js';

// ── Types ───────────────────────────────────────────────

export class ProtectedFileError extends Error {
  constructor(filePath: string) {
    super(`Cannot modify protected file: ${filePath}`);
    this.name = 'ProtectedFileError';
  }
}

export class SelfModRateLimitError extends Error {
  constructor(limit: number) {
    super(`Self-modification rate limit exceeded: max ${limit} per hour`);
    this.name = 'SelfModRateLimitError';
  }
}

export type ModificationStatus = 'proposed' | 'approved' | 'applied' | 'verified' | 'rolled-back' | 'rejected';

export interface ModificationRecord {
  id: string;
  file: string;
  newContent: string;
  diff: string;
  reason: string;
  timestamp: string;
  status: ModificationStatus;
  gitCommit?: string;
}

export interface SelfModOptions {
  agentHome: string;
  allowedPaths: string[];
  protectedPaths: string[];
  maxModsPerHour: number;
  gitEnabled: boolean;
  requireApproval: boolean;
}

// ── Manager ─────────────────────────────────────────────

export class SelfModManager {
  private records: ModificationRecord[] = [];
  private opts: SelfModOptions;
  private logger: Logger;
  private auditLogPath: string;

  constructor(opts: Partial<SelfModOptions> & { logger?: Logger } = {}) {
    this.opts = {
      agentHome: opts.agentHome ?? path.join(process.env['HOME'] ?? '/tmp', '.conshell'),
      allowedPaths: opts.allowedPaths ?? [],
      protectedPaths: opts.protectedPaths ?? ['SOUL.md', 'constitution.md', 'THREE_LAWS.md'],
      maxModsPerHour: opts.maxModsPerHour ?? 10,
      gitEnabled: opts.gitEnabled ?? true,
      requireApproval: opts.requireApproval ?? false,
    };
    this.logger = opts.logger ?? {
      debug: () => {}, info: () => {}, warn: () => {}, error: () => {},
      child: () => this.logger,
    };
    this.auditLogPath = path.join(this.opts.agentHome, 'audit.jsonl');
  }

  /**
   * Propose a self-modification to a file.
   * Validates against constitution, generates a diff, but DOES NOT WRITE the file yet.
   */
  async propose(file: string, content: string, reason: string): Promise<ModificationRecord> {
    // 1. Check protected files
    if (isProtectedFile(file) || this.opts.protectedPaths.some(p => file.includes(p))) {
      throw new ProtectedFileError(file);
    }

    // 2. Generate diff
    const absPath = path.isAbsolute(file) ? file : path.join(this.opts.agentHome, file);
    let diff = '';
    if (fs.existsSync(absPath)) {
      const oldContent = fs.readFileSync(absPath, 'utf-8');
      diff = generateSimpleDiff(oldContent, content);
    } else {
      diff = `+++ new file: ${file}\n${content.split('\n').map(l => `+ ${l}`).join('\n')}`;
    }

    // 3. Create proposed record
    const record: ModificationRecord = {
      id: `mod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      file,
      newContent: content,
      diff: diff.slice(0, 2000), // Truncate long diffs
      reason,
      timestamp: new Date().toISOString(),
      status: this.opts.requireApproval ? 'proposed' : 'approved',
    };

    this.records.push(record);
    this.appendAuditLog(record);
    this.logger.info('Self-modification proposed', { id: record.id, file, reason, status: record.status });

    return record;
  }

  /** Approve a proposed modification */
  approve(recordId: string): ModificationRecord {
    const record = this.records.find(r => r.id === recordId);
    if (!record) throw new Error(`Modification record not found: ${recordId}`);
    if (record.status !== 'proposed') throw new Error(`Cannot approve record in status: ${record.status}`);
    
    record.status = 'approved';
    this.appendAuditLog(record);
    this.logger.info('Self-modification approved', { id: recordId });
    return record;
  }

  /** Reject a proposed modification */
  reject(recordId: string): ModificationRecord {
    const record = this.records.find(r => r.id === recordId);
    if (!record) throw new Error(`Modification record not found: ${recordId}`);
    if (record.status !== 'proposed') throw new Error(`Cannot reject record in status: ${record.status}`);
    
    record.status = 'rejected';
    this.appendAuditLog(record);
    this.logger.info('Self-modification rejected', { id: recordId });
    return record;
  }

  /**
   * Apply an approved modification to disk and commit to git.
   */
  async apply(recordId: string): Promise<ModificationRecord> {
    const record = this.records.find(r => r.id === recordId);
    if (!record) throw new Error(`Modification record not found: ${recordId}`);
    if (record.status !== 'approved') throw new Error(`Cannot apply record in status: ${record.status}`);

    // Rate limit check
    const hourAgo = Date.now() - 3600_000;
    const recentMods = this.records.filter(
      r => new Date(r.timestamp).getTime() > hourAgo && r.status === 'applied'
    );
    if (recentMods.length >= this.opts.maxModsPerHour) {
      throw new SelfModRateLimitError(this.opts.maxModsPerHour);
    }

    const absPath = path.isAbsolute(record.file) ? record.file : path.join(this.opts.agentHome, record.file);
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    // Write file
    fs.writeFileSync(absPath, record.newContent, 'utf-8');

    // Git commit
    if (this.opts.gitEnabled) {
      record.gitCommit = this.gitCommit(absPath, `selfmod: ${record.reason}`);
    }

    record.status = 'applied';
    this.appendAuditLog(record);
    this.logger.info('Self-modification applied', { id: recordId, file: record.file });

    return record;
  }

  /** Verify an applied modification */
  verify(recordId: string): ModificationRecord {
    const record = this.records.find(r => r.id === recordId);
    if (!record) throw new Error(`Modification record not found: ${recordId}`);
    if (record.status !== 'applied') throw new Error(`Cannot verify record in status: ${record.status}`);
    
    record.status = 'verified';
    this.appendAuditLog(record);
    this.logger.info('Self-modification verified', { id: recordId });
    return record;
  }

  /**
   * Rollback a previous modification by git commit hash.
   */
  async rollback(recordId: string): Promise<boolean> {
    const record = this.records.find(r => r.id === recordId);
    if (!record || !record.gitCommit) return false;

    try {
      execSync(`git revert --no-commit ${record.gitCommit}`, {
        cwd: this.opts.agentHome,
        timeout: 10_000,
      });
      execSync(`git commit -m "rollback: ${recordId}"`, {
        cwd: this.opts.agentHome,
        timeout: 5_000,
      });
      record.status = 'rolled-back';
      this.logger.info('Self-modification rolled back', { id: recordId });
      return true;
    } catch (err) {
      this.logger.error('Rollback failed', { id: recordId, error: String(err) });
      return false;
    }
  }

  /** Get all modification records */
  history(opts?: { since?: Date; file?: string }): ModificationRecord[] {
    let records = [...this.records];
    if (opts?.since) {
      const ts = opts.since.getTime();
      records = records.filter(r => new Date(r.timestamp).getTime() >= ts);
    }
    if (opts?.file) {
      records = records.filter(r => r.file.includes(opts.file!));
    }
    return records;
  }

  /** Stats for the creator's audit dashboard */
  stats(): { total: number; lastHour: number; rolledBack: number } {
    const hourAgo = Date.now() - 3600_000;
    return {
      total: this.records.length,
      lastHour: this.records.filter(r => new Date(r.timestamp).getTime() > hourAgo).length,
      rolledBack: this.records.filter(r => r.status === 'rolled-back').length,
    };
  }

  // ── Private ─────────────────────────────────────────

  private gitCommit(filePath: string, message: string): string | undefined {
    try {
      // Init git repo if not exists
      const gitDir = path.join(this.opts.agentHome, '.git');
      if (!fs.existsSync(gitDir)) {
        execSync('git init', { cwd: this.opts.agentHome, timeout: 5_000 });
      }
      execSync(`git add "${filePath}"`, { cwd: this.opts.agentHome, timeout: 5_000 });
      execSync(`git commit -m "${message.replace(/"/g, '\\"')}" --allow-empty`, {
        cwd: this.opts.agentHome,
        timeout: 5_000,
      });
      const hash = execSync('git rev-parse HEAD', { cwd: this.opts.agentHome, timeout: 3_000 })
        .toString().trim();
      return hash;
    } catch {
      return undefined;
    }
  }

  private appendAuditLog(record: ModificationRecord): void {
    try {
      const dir = path.dirname(this.auditLogPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(this.auditLogPath, JSON.stringify(record) + '\n');
    } catch { /* best effort */ }
  }
}

// ── Helpers ─────────────────────────────────────────────

function generateSimpleDiff(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const diff: string[] = [];

  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    if (i >= oldLines.length) {
      diff.push(`+ ${newLines[i]}`);
    } else if (i >= newLines.length) {
      diff.push(`- ${oldLines[i]}`);
    } else if (oldLines[i] !== newLines[i]) {
      diff.push(`- ${oldLines[i]}`);
      diff.push(`+ ${newLines[i]}`);
    }
  }

  return diff.join('\n');
}
