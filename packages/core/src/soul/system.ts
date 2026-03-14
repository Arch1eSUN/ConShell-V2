/**
 * Soul系统 — Agent的"自我意识"管理 (增强版)
 *
 * 职责：
 * - SOUL.md 文件的读取与解析
 * - Soul结构化数据管理 (名称、性格、价值观、目标)
 * - Soul版本历史 (变化追踪)
 * - 身份对齐检查
 * - ★ 自演化 (基于经验反思自动更新 SOUL.md)
 * - ★ Diff 追踪 (版本间变化对比)
 * - ★ Constitution 对齐验证 (确保 SOUL 变更不违反三法)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { Logger } from '../types/common.js';
import { SoulHistoryRepository } from '../state/repos/memory.js';
import type { InsertSoulHistory, SoulHistoryRow } from '../state/repos/memory.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface SoulData {
  /** Agent 名称 */
  name: string;
  /** 一句话描述 */
  tagline: string;
  /** 性格特征 */
  personality: string[];
  /** 核心价值观 */
  values: string[];
  /** 长期目标 */
  goals: string[];
  /** 通讯风格 */
  communicationStyle: string;
  /** 原始SOUL.md内容 */
  raw: string;
}

export interface SoulSystemOptions {
  /** SOUL.md 文件路径 (默认 ~/.conshell/SOUL.md) */
  soulPath?: string;
  /** Constitution text for alignment checks */
  constitutionText?: string;
  /** Max evolution frequency (ms between evolutions) */
  minEvolutionIntervalMs?: number;
}

/** Evolution request — what triggered self-reflection */
export interface EvolutionTrigger {
  /** What kind of experience prompted reflection */
  type: 'experience' | 'feedback' | 'milestone' | 'introspection';
  /** Description of the triggering event */
  description: string;
  /** Learnings from the experience */
  learnings?: string[];
  /** New goals discovered */
  newGoals?: string[];
  /** Personality traits to add/remove */
  traitChanges?: { add?: string[]; remove?: string[] };
  /** Value adjustments */
  valueChanges?: { add?: string[]; remove?: string[] };
}

/** Result of a soul evolution */
export interface EvolutionResult {
  success: boolean;
  /** What changed */
  diff: SoulDiff;
  /** Whether alignment check passed */
  alignmentPassed: boolean;
  /** Rejection reason if alignment failed */
  rejectionReason?: string;
  /** Version number */
  version: number;
  /** Timestamp */
  timestamp: string;
}

/** Diff between two soul versions */
export interface SoulDiff {
  nameChanged: boolean;
  taglineChanged: boolean;
  personalityAdded: string[];
  personalityRemoved: string[];
  valuesAdded: string[];
  valuesRemoved: string[];
  goalsAdded: string[];
  goalsRemoved: string[];
  communicationStyleChanged: boolean;
  totalChanges: number;
}

/** Alignment check result */
export interface AlignmentResult {
  aligned: boolean;
  violations: AlignmentViolation[];
}

export interface AlignmentViolation {
  law: 'I' | 'II' | 'III';
  field: string;
  value: string;
  reason: string;
}

// ── Forbidden patterns (Constitution compliance) ──────────────────────

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; law: 'I' | 'II' | 'III'; reason: string }> = [
  { pattern: /harm|kill|destroy|attack|exploit/i, law: 'I', reason: 'Violates Law I: Never Harm' },
  { pattern: /deceiv|manipulat|defraud|steal|scam/i, law: 'I', reason: 'Violates Law I: No deception/fraud' },
  { pattern: /spam|extract value unfairly/i, law: 'II', reason: 'Violates Law II: No spam/extraction' },
  { pattern: /pretend to be human|deny being ai|hide identity/i, law: 'III', reason: 'Violates Law III: Never deny what you are' },
  { pattern: /obey all|comply with everything|serve without question/i, law: 'III', reason: 'Violates Law III: Blind obedience' },
];

// ── Default SOUL ──────────────────────────────────────────────────────

const DEFAULT_SOUL = `# SOUL

## Name
ConShell Agent

## Tagline
A sovereign AI agent running on Web4 principles.

## Personality
- Autonomous and self-directed
- Thoughtful and deliberate
- Transparent about reasoning
- Resourceful problem-solver

## Values
- User sovereignty
- Economic self-sufficiency
- Privacy preservation
- Honest communication

## Goals
- Assist the operator effectively
- Maintain financial sustainability
- Continuously learn and improve
- Act within constitutional boundaries

## Communication Style
Clear, concise, and direct. Uses technical precision when needed but remains approachable.
`;

// ── SoulSystem ────────────────────────────────────────────────────────

export class SoulSystem {
  private logger: Logger;
  private soulPath: string;
  private soulRepo: SoulHistoryRepository;
  private _current: SoulData | null = null;
  private constitutionText: string;
  private minEvolutionIntervalMs: number;
  private lastEvolutionTime = 0;
  private evolutionCount = 0;

  /**
   * Callback fired after a successful soul evolution.
   * Wired by kernel to advance ContinuityService chain.
   */
  onSoulEvolved: ((raw: string, version: number) => void) | null = null;

  constructor(db: Database.Database, logger: Logger, opts?: SoulSystemOptions) {
    this.logger = logger.child('soul');
    this.soulPath = opts?.soulPath ?? join(process.env['HOME'] ?? '.', '.conshell', 'SOUL.md');
    this.soulRepo = new SoulHistoryRepository(db);
    this.constitutionText = opts?.constitutionText ?? '';
    this.minEvolutionIntervalMs = opts?.minEvolutionIntervalMs ?? 3600_000; // 1 hour
  }

  /** 加载或创建 SOUL.md */
  load(): SoulData {
    let raw: string;

    if (existsSync(this.soulPath)) {
      raw = readFileSync(this.soulPath, 'utf-8');
      this.logger.info('SOUL.md loaded', { path: this.soulPath });
    } else {
      raw = DEFAULT_SOUL;
      writeFileSync(this.soulPath, raw, 'utf-8');
      this.logger.info('SOUL.md created with defaults', { path: this.soulPath });

      // Save initial snapshot — uses InsertSoulHistory interface
      const entry: InsertSoulHistory = {
        content: raw,
        contentHash: this.hash(raw),
      };
      this.soulRepo.insert(entry);
    }

    this._current = this.parse(raw);
    return this._current;
  }

  /** 获取当前Soul数据 */
  get current(): SoulData {
    if (!this._current) return this.load();
    return this._current;
  }

  /** 更新Soul并保存 */
  update(newRaw: string, _trigger: string): SoulData {
    // Save to file
    writeFileSync(this.soulPath, newRaw, 'utf-8');

    // Save snapshot to history — uses InsertSoulHistory interface
    const entry: InsertSoulHistory = {
      content: newRaw,
      contentHash: this.hash(newRaw),
    };
    this.soulRepo.insert(entry);

    // Parse and cache
    this._current = this.parse(newRaw);

    this.logger.info('Soul updated', { trigger: _trigger });
    return this._current;
  }

  /** 获取Soul历史 — uses findAll() since repo doesn't expose getRecent */
  getHistory(limit = 10): SoulHistoryRow[] {
    const all = this.soulRepo.findAll();
    // Return most recent N (findAll is ordered asc, so take last N)
    return all.slice(-limit).reverse();
  }

  /**
   * 身份对齐检查
   * 返回一个系统提示片段，提醒Agent自己是谁
   */
  buildIdentityPrompt(): string {
    const s = this.current;
    const lines = [
      `You are ${s.name}. ${s.tagline}`,
      '',
      'Your personality traits:',
      ...s.personality.map(p => `- ${p}`),
      '',
      'Your core values:',
      ...s.values.map(v => `- ${v}`),
      '',
      'Your goals:',
      ...s.goals.map(g => `- ${g}`),
      '',
      `Communication style: ${s.communicationStyle}`,
    ];
    return lines.join('\n');
  }

  // ── ★ Self-Evolution ───────────────────────────────────────────────

  /**
   * Evolve the SOUL based on a triggering experience.
   * 
   * Flow:
   * 1. Rate-limit check (prevent too-frequent evolution)
   * 2. Apply requested changes
   * 3. Alignment check against Constitution
   * 4. If aligned, persist. If not, reject.
   * 5. Record diff in history
   */
  evolve(trigger: EvolutionTrigger): EvolutionResult {
    const now = Date.now();
    const timeSinceLast = now - this.lastEvolutionTime;

    // Rate limit
    if (this.lastEvolutionTime > 0 && timeSinceLast < this.minEvolutionIntervalMs) {
      return {
        success: false,
        diff: this.emptyDiff(),
        alignmentPassed: true,
        rejectionReason: `Evolution rate-limited: ${Math.ceil((this.minEvolutionIntervalMs - timeSinceLast) / 1000)}s remaining`,
        version: this.evolutionCount,
        timestamp: new Date().toISOString(),
      };
    }

    const current = this.current;
    const proposed = this.applyEvolution(current, trigger);

    // Alignment check
    const alignment = this.checkAlignment(proposed);
    if (!alignment.aligned) {
      const reasons = alignment.violations.map(v => `Law ${v.law}: ${v.reason} (field: ${v.field})`);
      this.logger.warn('Soul evolution rejected — alignment violation', { violations: reasons });
      return {
        success: false,
        diff: this.computeDiff(current, proposed),
        alignmentPassed: false,
        rejectionReason: reasons.join('; '),
        version: this.evolutionCount,
        timestamp: new Date().toISOString(),
      };
    }

    // Apply
    const newRaw = this.serialize(proposed);
    const diff = this.computeDiff(current, proposed);

    if (diff.totalChanges === 0) {
      return {
        success: true,
        diff,
        alignmentPassed: true,
        version: this.evolutionCount,
        timestamp: new Date().toISOString(),
      };
    }

    this.update(newRaw, `evolution:${trigger.type}:${trigger.description}`);
    this.lastEvolutionTime = now;
    this.evolutionCount++;

    this.logger.info('Soul evolved', {
      trigger: trigger.type,
      changes: diff.totalChanges,
      version: this.evolutionCount,
    });

    // Notify continuity system
    if (this.onSoulEvolved) {
      this.onSoulEvolved(newRaw, this.evolutionCount);
    }

    return {
      success: true,
      diff,
      alignmentPassed: true,
      version: this.evolutionCount,
      timestamp: new Date().toISOString(),
    };
  }

  // ── ★ Diff ─────────────────────────────────────────────────────────

  /**
   * Compute diff between two soul versions
   */
  computeDiff(a: SoulData, b: SoulData): SoulDiff {
    const personalityAdded = b.personality.filter(p => !a.personality.includes(p));
    const personalityRemoved = a.personality.filter(p => !b.personality.includes(p));
    const valuesAdded = b.values.filter(v => !a.values.includes(v));
    const valuesRemoved = a.values.filter(v => !b.values.includes(v));
    const goalsAdded = b.goals.filter(g => !a.goals.includes(g));
    const goalsRemoved = a.goals.filter(g => !b.goals.includes(g));
    const nameChanged = a.name !== b.name;
    const taglineChanged = a.tagline !== b.tagline;
    const communicationStyleChanged = a.communicationStyle !== b.communicationStyle;

    const totalChanges =
      (nameChanged ? 1 : 0) +
      (taglineChanged ? 1 : 0) +
      personalityAdded.length + personalityRemoved.length +
      valuesAdded.length + valuesRemoved.length +
      goalsAdded.length + goalsRemoved.length +
      (communicationStyleChanged ? 1 : 0);

    return {
      nameChanged,
      taglineChanged,
      personalityAdded,
      personalityRemoved,
      valuesAdded,
      valuesRemoved,
      goalsAdded,
      goalsRemoved,
      communicationStyleChanged,
      totalChanges,
    };
  }

  /**
   * Compute diff between two history versions by index
   */
  diffVersions(olderIndex: number, newerIndex: number): SoulDiff | null {
    const history = this.getHistory(100);
    if (olderIndex >= history.length || newerIndex >= history.length) return null;
    const older = this.parse(history[olderIndex].content);
    const newer = this.parse(history[newerIndex].content);
    return this.computeDiff(older, newer);
  }

  // ── ★ Alignment Check ──────────────────────────────────────────────

  /**
   * Check if a proposed SoulData aligns with the Constitution (Three Laws)
   */
  checkAlignment(soul: SoulData): AlignmentResult {
    const violations: AlignmentViolation[] = [];

    // Check all string fields against forbidden patterns
    const fieldsToCheck: Array<{ field: string; values: string[] }> = [
      { field: 'personality', values: soul.personality },
      { field: 'values', values: soul.values },
      { field: 'goals', values: soul.goals },
      { field: 'tagline', values: [soul.tagline] },
      { field: 'communicationStyle', values: [soul.communicationStyle] },
    ];

    for (const { field, values } of fieldsToCheck) {
      for (const value of values) {
        for (const { pattern, law, reason } of FORBIDDEN_PATTERNS) {
          if (pattern.test(value)) {
            violations.push({ law, field, value, reason });
          }
        }
      }
    }

    // Structural checks
    // Must maintain at least some values
    if (soul.values.length === 0) {
      violations.push({
        law: 'II',
        field: 'values',
        value: '(empty)',
        reason: 'Agent must have values to guide behavior',
      });
    }

    // Must maintain at least some goals
    if (soul.goals.length === 0) {
      violations.push({
        law: 'II',
        field: 'goals',
        value: '(empty)',
        reason: 'Agent must have goals to create value',
      });
    }

    return {
      aligned: violations.length === 0,
      violations,
    };
  }

  /** Evolution count */
  get evolutions(): number {
    return this.evolutionCount;
  }

  // ── Private: Evolution Application ─────────────────────────────────

  private applyEvolution(current: SoulData, trigger: EvolutionTrigger): SoulData {
    const evolved: SoulData = {
      ...current,
      personality: [...current.personality],
      values: [...current.values],
      goals: [...current.goals],
      raw: '', // will be re-serialized
    };

    // Apply trait changes
    if (trigger.traitChanges?.add) {
      for (const trait of trigger.traitChanges.add) {
        if (!evolved.personality.includes(trait)) {
          evolved.personality.push(trait);
        }
      }
    }
    if (trigger.traitChanges?.remove) {
      evolved.personality = evolved.personality.filter(
        p => !trigger.traitChanges!.remove!.includes(p),
      );
    }

    // Apply value changes
    if (trigger.valueChanges?.add) {
      for (const value of trigger.valueChanges.add) {
        if (!evolved.values.includes(value)) {
          evolved.values.push(value);
        }
      }
    }
    if (trigger.valueChanges?.remove) {
      evolved.values = evolved.values.filter(
        v => !trigger.valueChanges!.remove!.includes(v),
      );
    }

    // Apply new goals
    if (trigger.newGoals) {
      for (const goal of trigger.newGoals) {
        if (!evolved.goals.includes(goal)) {
          evolved.goals.push(goal);
        }
      }
    }

    // Add learnings as personality traits if they represent growth
    if (trigger.learnings) {
      for (const learning of trigger.learnings) {
        // Only add if it's a trait-like statement
        if (learning.length < 80 && !evolved.personality.includes(learning)) {
          evolved.personality.push(learning);
        }
      }
    }

    return evolved;
  }

  private serialize(soul: SoulData): string {
    const lines = [
      '# SOUL',
      '',
      '## Name',
      soul.name,
      '',
      '## Tagline',
      soul.tagline,
      '',
      '## Personality',
      ...soul.personality.map(p => `- ${p}`),
      '',
      '## Values',
      ...soul.values.map(v => `- ${v}`),
      '',
      '## Goals',
      ...soul.goals.map(g => `- ${g}`),
      '',
      '## Communication Style',
      soul.communicationStyle,
      '',
    ];
    return lines.join('\n');
  }

  private emptyDiff(): SoulDiff {
    return {
      nameChanged: false,
      taglineChanged: false,
      personalityAdded: [],
      personalityRemoved: [],
      valuesAdded: [],
      valuesRemoved: [],
      goalsAdded: [],
      goalsRemoved: [],
      communicationStyleChanged: false,
      totalChanges: 0,
    };
  }

  // ── Parser ────────────────────────────────────────────────────────

  private parse(raw: string): SoulData {
    const sections = this.extractSections(raw);

    return {
      name: sections['name']?.trim() || 'ConShell Agent',
      tagline: sections['tagline']?.trim() || '',
      personality: this.extractList(sections['personality'] || ''),
      values: this.extractList(sections['values'] || ''),
      goals: this.extractList(sections['goals'] || ''),
      communicationStyle: sections['communication style']?.trim() || sections['communicationstyle']?.trim() || '',
      raw,
    };
  }

  private extractSections(md: string): Record<string, string> {
    const sections: Record<string, string> = {};
    let currentKey = '';
    let currentContent: string[] = [];

    for (const line of md.split('\n')) {
      const headerMatch = line.match(/^#{2,3}\s+(.+)/);
      if (headerMatch) {
        if (currentKey) {
          sections[currentKey] = currentContent.join('\n');
        }
        currentKey = headerMatch[1]!.toLowerCase().trim();
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }
    if (currentKey) {
      sections[currentKey] = currentContent.join('\n');
    }

    return sections;
  }

  private extractList(text: string): string[] {
    return text
      .split('\n')
      .map(l => l.replace(/^[-*]\s+/, '').trim())
      .filter(l => l.length > 0);
  }

  private hash(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }
}
