/**
 * 记忆层管理器 — 3-Tier Memory (Hot / Warm / Cold)
 *
 * Hot  = Working Memory (当前会话上下文, RAM only)
 * Warm = Episodic + Semantic + Relationship (SQLite, 中频访问)
 * Cold = Procedural + 长期知识 (SQLite, 低频访问)
 *
 * 职责：
 * - 为LLM调用构建最优记忆上下文
 * - 上下文窗口管理 (token budget)
 * - 与Phase A的Repositories对接
 */
import type Database from 'better-sqlite3';
import type { Logger } from '../types/common.js';
import {
  WorkingMemoryRepository,
  EpisodicMemoryRepository,
  SemanticMemoryRepository,
  ProceduralMemoryRepository,
  RelationshipMemoryRepository,
  SoulHistoryRepository,
  SessionSummariesRepository,
} from '../state/repos/memory.js';
import type {
  EpisodicMemoryRow,
  SemanticMemoryRow,
  ProceduralMemoryRow,
  RelationshipMemoryRow,
  SessionSummaryRow,
} from '../state/repos/memory.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface MemoryContext {
  /** 近期对话摘要 */
  sessionSummaries: string[];
  /** 相关事实 (semantic) */
  relevantFacts: string[];
  /** 人物/实体关系 */
  relationships: string[];
  /** 最近事件 (episodic) */
  recentEpisodes: string[];
  /** 已习得技能 (procedural) */
  skills: string[];
  /** 总 token 估算 */
  estimatedTokens: number;
}

export interface TierManagerOptions {
  /** 最大上下文 token 预算 (默认 8000) */
  maxContextTokens?: number;
  /** Hot 层条目上限 (默认 50) */
  hotLimit?: number;
  /** Warm 查询限制 (默认 20) */
  warmLimit?: number;
  /** Cold 查询限制 (默认 10) */
  coldLimit?: number;
}

// ── TierManager ───────────────────────────────────────────────────────

export class MemoryTierManager {
  private logger: Logger;
  private opts: Required<TierManagerOptions>;

  // Repos (warm/cold — backed by SQLite)
  private workingRepo: WorkingMemoryRepository;
  private episodicRepo: EpisodicMemoryRepository;
  private semanticRepo: SemanticMemoryRepository;
  private proceduralRepo: ProceduralMemoryRepository;
  private relationshipRepo: RelationshipMemoryRepository;
  private soulRepo: SoulHistoryRepository;
  private sessionRepo: SessionSummariesRepository;

  // Hot tier — in-memory buffer for current session
  private hotBuffers = new Map<string, Array<{ role: string; content: string; ts: number }>>();

  constructor(db: Database.Database, logger: Logger, opts?: TierManagerOptions) {
    this.logger = logger.child('memory');
    this.opts = {
      maxContextTokens: opts?.maxContextTokens ?? 8000,
      hotLimit: opts?.hotLimit ?? 50,
      warmLimit: opts?.warmLimit ?? 20,
      coldLimit: opts?.coldLimit ?? 10,
    };

    this.workingRepo = new WorkingMemoryRepository(db);
    this.episodicRepo = new EpisodicMemoryRepository(db);
    this.semanticRepo = new SemanticMemoryRepository(db);
    this.proceduralRepo = new ProceduralMemoryRepository(db);
    this.relationshipRepo = new RelationshipMemoryRepository(db);
    this.soulRepo = new SoulHistoryRepository(db);
    this.sessionRepo = new SessionSummariesRepository(db);
  }

  // ── Hot Tier (per-session working memory) ─────────────────────────

  /** 追加到 session-scoped hot buffer */
  pushHot(sessionId: string, role: string, content: string): void {
    let buf = this.hotBuffers.get(sessionId);
    if (!buf) {
      buf = [];
      this.hotBuffers.set(sessionId, buf);
    }
    buf.push({ role, content, ts: Date.now() });
    if (buf.length > this.opts.hotLimit) {
      buf.shift(); // FIFO eviction
    }
  }

  /** 获取 session-scoped hot buffer 内容 */
  getHot(sessionId: string): Array<{ role: string; content: string }> {
    const buf = this.hotBuffers.get(sessionId);
    if (!buf) return [];
    return buf.map(({ role, content }) => ({ role, content }));
  }

  /** 清除 hot buffer. If sessionId provided, clear that session only; otherwise clear all. */
  clearHot(sessionId?: string): void {
    if (sessionId) {
      this.hotBuffers.delete(sessionId);
    } else {
      this.hotBuffers.clear();
    }
  }

  // ── 上下文构建 ────────────────────────────────────────────────────

  /**
   * 构建LLM上下文
   * 按优先级填充 token 预算：
   * 1. 会话摘要
   * 2. 语义事实
   * 3. 实体关系
   * 4. 近期事件
   * 5. 技能知识
   */
  buildContext(): MemoryContext {
    let tokenBudget = this.opts.maxContextTokens;
    const ctx: MemoryContext = {
      sessionSummaries: [],
      relevantFacts: [],
      relationships: [],
      recentEpisodes: [],
      skills: [],
      estimatedTokens: 0,
    };

    // 1. Session summaries (warm) — uses findRecent()
    const summaries: SessionSummaryRow[] = this.sessionRepo.findRecent(5);
    for (const s of summaries) {
      const tokens = this.estimateTokens(s.summary);
      if (tokenBudget - tokens < 0) break;
      ctx.sessionSummaries.push(s.summary);
      tokenBudget -= tokens;
    }

    // 2. Semantic facts (warm) — uses findAll(), then slice
    const allFacts: SemanticMemoryRow[] = this.semanticRepo.findAll();
    const facts = allFacts.slice(0, this.opts.warmLimit);
    for (const f of facts) {
      const text = `[${f.category}/${f.key}] ${f.value}`;
      const tokens = this.estimateTokens(text);
      if (tokenBudget - tokens < 0) break;
      ctx.relevantFacts.push(text);
      tokenBudget -= tokens;
    }

    // 3. Relationships (warm) — uses findAll(), then slice
    const allRels: RelationshipMemoryRow[] = this.relationshipRepo.findAll();
    const rels = allRels.slice(0, this.opts.warmLimit);
    for (const r of rels) {
      const text = `${r.entity_id} (${r.entity_type}) trust:${r.trust_score} interactions:${r.interaction_count}`;
      const tokens = this.estimateTokens(text);
      if (tokenBudget - tokens < 0) break;
      ctx.relationships.push(text);
      tokenBudget -= tokens;
    }

    // 4. Episodic memories (warm) — uses findTopByImportance()
    const episodes: EpisodicMemoryRow[] = this.episodicRepo.findTopByImportance(this.opts.warmLimit);
    for (const e of episodes) {
      const text = `[${e.event_type}] ${e.content}`;
      const tokens = this.estimateTokens(text);
      if (tokenBudget - tokens < 0) break;
      ctx.recentEpisodes.push(text);
      tokenBudget -= tokens;
    }

    // 5. Procedural knowledge (cold) — uses findAll(), then slice
    const allProcs: ProceduralMemoryRow[] = this.proceduralRepo.findAll();
    const procedures = allProcs.slice(0, this.opts.coldLimit);
    for (const p of procedures) {
      const text = `Skill "${p.name}": success=${p.success_count} fail=${p.failure_count}`;
      const tokens = this.estimateTokens(text);
      if (tokenBudget - tokens < 0) break;
      ctx.skills.push(text);
      tokenBudget -= tokens;
    }

    ctx.estimatedTokens = this.opts.maxContextTokens - tokenBudget;
    return ctx;
  }

  // ── 记忆存储 (代理到repos) ─────────────────────────────────────────

  /** 存储事实到 semantic 层 */
  storeFact(category: string, key: string, value: string, confidence?: number, source?: string): void {
    this.semanticRepo.upsert({ category, key, value, confidence, source });
    this.logger.debug('Stored semantic fact', { category, key });
  }

  /** 存储事件到 episodic 层 */
  storeEpisode(eventType: string, content: string, importance?: number, sessionId?: string): void {
    this.episodicRepo.insert({ eventType, content, importance, sessionId });
    this.logger.debug('Stored episodic memory', { eventType });
  }

  /** 存储/更新关系 */
  storeRelationship(entityId: string, entityType: string, trustDelta?: number, notes?: string): void {
    this.relationshipRepo.upsert({ entityId, entityType, trustDelta, notes });
    this.logger.debug('Stored relationship', { entityId, entityType });
  }

  /** 存储技能知识到 procedural 层 */
  storeProcedure(name: string, stepsJson: string): void {
    this.proceduralRepo.upsert({ name, stepsJson });
    this.logger.debug('Stored procedural knowledge', { name });
  }

  /** 保存会话摘要 */
  saveSessionSummary(sessionId: string, summary: string, outcome?: string): void {
    this.sessionRepo.upsert(sessionId, summary, outcome);
    this.logger.debug('Saved session summary', { sessionId });
  }

  /** 保存Soul历史快照 — 需要contentHash */
  saveSoulSnapshot(content: string, contentHash: string, alignmentScore?: number): void {
    this.soulRepo.insert({ content, contentHash, alignmentScore });
    this.logger.debug('Saved soul snapshot');
  }

  // ── 统计 ──────────────────────────────────────────────────────────

  stats(): {
    hotSize: number;
    soulVersions: number;
  } {
    let hotSize = 0;
    for (const buf of this.hotBuffers.values()) hotSize += buf.length;
    return {
      hotSize,
      soulVersions: this.soulRepo.count(),
    };
  }

  // ── helpers ───────────────────────────────────────────────────────

  /** 粗略 token 估算 (4 chars ≈ 1 token) */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
