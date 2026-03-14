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
  /** Identity anchor ID — propagated into memory writes */
  ownerId?: string;
  /**
   * Owner-local budget ratio (Round 15.1 — Goal D).
   * When ownerId is set, this fraction of maxContextTokens is reserved for
   * owner-scoped tiers (summaries + episodes). The remainder goes to shared
   * tiers (facts + relationships + skills). Default: 0.6 (60% owner-local).
   */
  ownerBudgetRatio?: number;
}

// ── TierManager ───────────────────────────────────────────────────────

export class MemoryTierManager {
  private logger: Logger;
  private opts: Required<Omit<TierManagerOptions, 'ownerId'>> & { ownerId: string | undefined; ownerBudgetRatio: number };

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
      ownerId: opts?.ownerId,
      ownerBudgetRatio: opts?.ownerBudgetRatio ?? 0.6,
    };

    this.workingRepo = new WorkingMemoryRepository(db);
    this.episodicRepo = new EpisodicMemoryRepository(db);
    this.semanticRepo = new SemanticMemoryRepository(db);
    this.proceduralRepo = new ProceduralMemoryRepository(db);
    this.relationshipRepo = new RelationshipMemoryRepository(db);
    this.soulRepo = new SoulHistoryRepository(db);
    this.sessionRepo = new SessionSummariesRepository(db);
  }

  /** Total episodic memory count — used by Kernel for session continuity wiring. */
  getEpisodeCount(): number {
    return this.episodicRepo.count();
  }

  /** Episode count scoped to a specific owner (Goal D — Round 15.0.2). */
  getEpisodeCountForOwner(ownerId: string): number {
    return this.episodicRepo.countByOwner(ownerId);
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

  /**
   * 构建LLM上下文 (Round 15.1.1 — hardened)
   *
   * Budget strategy (Round 15.1.1 — dynamic reflow):
   * - When ownerId is set: initial split 60/40 (owner/shared)
   * - After first pass: leftover from either bucket flows to the other
   * - When no ownerId: unified budget
   *
   * Dedup strategy (Round 15.1.1 — soft dedup):
   * - Overlapping episodes are demoted with [echo] prefix, not deleted
   * - Non-overlapping episodes packed first, then demoted ones fill remaining budget
   */
  buildContext(): MemoryContext {
    const totalBudget = this.opts.maxContextTokens;
    const ctx: MemoryContext = {
      sessionSummaries: [],
      relevantFacts: [],
      relationships: [],
      recentEpisodes: [],
      skills: [],
      estimatedTokens: 0,
    };

    // Budget split: owner-local vs shared
    const hasOwner = !!this.opts.ownerId;
    let ownerBudget = hasOwner
      ? Math.floor(totalBudget * this.opts.ownerBudgetRatio)
      : totalBudget;
    let sharedBudget = hasOwner
      ? totalBudget - ownerBudget
      : totalBudget;

    // ── Pass 1: Owner-scoped tiers ──────────────────────────────────

    // 1. Session summaries
    const summaries: SessionSummaryRow[] = this.opts.ownerId
      ? this.sessionRepo.findRecentByOwner(this.opts.ownerId, 5)
      : this.sessionRepo.findRecent(5);
    for (const s of summaries) {
      const tokens = this.estimateTokens(s.summary);
      if (ownerBudget - tokens < 0) break;
      ctx.sessionSummaries.push(s.summary);
      ownerBudget -= tokens;
    }

    // 2. Episodic memories — soft dedup: demote overlapping, don't delete
    const episodes: EpisodicMemoryRow[] = this.opts.ownerId
      ? this.episodicRepo.findTopByRelevanceForOwner(this.opts.ownerId, this.opts.warmLimit)
      : this.episodicRepo.findTopByRelevance(this.opts.warmLimit);
    const demotedEpisodes: string[] = [];
    for (const e of episodes) {
      const text = `[${e.event_type}] ${e.content}`;
      if (this.isOverlappingWithSummaries(e.content, ctx.sessionSummaries)) {
        demotedEpisodes.push(`[echo] ${text}`); // soft dedup: demote, don't delete
        continue;
      }
      const tokens = this.estimateTokens(text);
      if (ownerBudget - tokens < 0) break;
      ctx.recentEpisodes.push(text);
      ownerBudget -= tokens;
    }

    // ── Pass 1: Shared tiers ────────────────────────────────────────

    // 3. Semantic facts
    const allFacts: SemanticMemoryRow[] = this.semanticRepo.findAll();
    const facts = allFacts.slice(0, this.opts.warmLimit);
    const skippedFacts: Array<{ text: string; tokens: number }> = [];
    for (const f of facts) {
      const text = `[${f.category}/${f.key}] ${f.value}`;
      const tokens = this.estimateTokens(text);
      if (sharedBudget - tokens < 0) {
        skippedFacts.push({ text, tokens });
        continue;
      }
      ctx.relevantFacts.push(text);
      sharedBudget -= tokens;
    }

    // 4. Relationships
    const allRels: RelationshipMemoryRow[] = this.relationshipRepo.findAll();
    const rels = allRels.slice(0, this.opts.warmLimit);
    const skippedRels: Array<{ text: string; tokens: number }> = [];
    for (const r of rels) {
      const text = `${r.entity_id} (${r.entity_type}) trust:${r.trust_score} interactions:${r.interaction_count}`;
      const tokens = this.estimateTokens(text);
      if (sharedBudget - tokens < 0) {
        skippedRels.push({ text, tokens });
        continue;
      }
      ctx.relationships.push(text);
      sharedBudget -= tokens;
    }

    // 5. Procedural knowledge
    const allProcs: ProceduralMemoryRow[] = this.proceduralRepo.findAll();
    const procedures = allProcs.slice(0, this.opts.coldLimit);
    for (const p of procedures) {
      const text = `Skill "${p.name}": success=${p.success_count} fail=${p.failure_count}`;
      const tokens = this.estimateTokens(text);
      if (sharedBudget - tokens < 0) break;
      ctx.skills.push(text);
      sharedBudget -= tokens;
    }

    // ── Pass 2: Dynamic budget reflow (Round 15.1.1) ────────────────
    if (hasOwner) {
      // Owner leftover → try fitting skipped shared items
      for (const item of [...skippedFacts]) {
        if (ownerBudget - item.tokens >= 0) {
          ctx.relevantFacts.push(item.text);
          ownerBudget -= item.tokens;
        }
      }
      for (const item of [...skippedRels]) {
        if (ownerBudget - item.tokens >= 0) {
          ctx.relationships.push(item.text);
          ownerBudget -= item.tokens;
        }
      }

      // Shared leftover → try fitting demoted episodes
      for (const text of demotedEpisodes) {
        const tokens = this.estimateTokens(text);
        if (sharedBudget - tokens >= 0) {
          ctx.recentEpisodes.push(text);
          sharedBudget -= tokens;
        }
      }
    } else {
      // Unified budget: just try fitting demoted episodes with remaining budget
      for (const text of demotedEpisodes) {
        const tokens = this.estimateTokens(text);
        if (ownerBudget - tokens >= 0) {
          ctx.recentEpisodes.push(text);
          ownerBudget -= tokens;
        }
      }
    }

    ctx.estimatedTokens = totalBudget - ownerBudget - sharedBudget;
    return ctx;
  }

  /**
   * P2-3: Build memory context explicitly scoped to the given ownerId.
   * Round 15.1.1 hardened: dynamic reflow + soft dedup.
   */
  buildContextForOwner(ownerId: string): MemoryContext {
    const totalBudget = this.opts.maxContextTokens;
    const ctx: MemoryContext = {
      sessionSummaries: [],
      relevantFacts: [],
      relationships: [],
      recentEpisodes: [],
      skills: [],
      estimatedTokens: 0,
    };

    // Budget split: always 60/40 since we have an explicit owner
    let ownerBudget = Math.floor(totalBudget * this.opts.ownerBudgetRatio);
    let sharedBudget = totalBudget - ownerBudget;

    // ── Pass 1: Owner-scoped tiers ─────────────────────────────────

    // 1. Owner-scoped session summaries
    const summaries = this.sessionRepo.findRecentByOwner(ownerId, 5);
    for (const s of summaries) {
      const tokens = this.estimateTokens(s.summary);
      if (ownerBudget - tokens < 0) break;
      ctx.sessionSummaries.push(s.summary);
      ownerBudget -= tokens;
    }

    // 2. Owner-scoped episodic memories — soft dedup
    const episodes = this.episodicRepo.findTopByRelevanceForOwner(ownerId, this.opts.warmLimit);
    const demotedEpisodes: string[] = [];
    for (const e of episodes) {
      const text = `[${e.event_type}] ${e.content}`;
      if (this.isOverlappingWithSummaries(e.content, ctx.sessionSummaries)) {
        demotedEpisodes.push(`[echo] ${text}`);
        continue;
      }
      const tokens = this.estimateTokens(text);
      if (ownerBudget - tokens < 0) break;
      ctx.recentEpisodes.push(text);
      ownerBudget -= tokens;
    }

    // ── Pass 1: Shared tiers ──────────────────────────────────────

    // 3. Shared semantic facts
    const facts = this.semanticRepo.findAll().slice(0, this.opts.warmLimit);
    const skippedFacts: Array<{ text: string; tokens: number }> = [];
    for (const f of facts) {
      const text = `[${f.category}/${f.key}] ${f.value}`;
      const tokens = this.estimateTokens(text);
      if (sharedBudget - tokens < 0) {
        skippedFacts.push({ text, tokens });
        continue;
      }
      ctx.relevantFacts.push(text);
      sharedBudget -= tokens;
    }

    // 4. Shared relationships
    const rels = this.relationshipRepo.findAll().slice(0, this.opts.warmLimit);
    const skippedRels: Array<{ text: string; tokens: number }> = [];
    for (const r of rels) {
      const text = `${r.entity_id} (${r.entity_type}) trust:${r.trust_score} interactions:${r.interaction_count}`;
      const tokens = this.estimateTokens(text);
      if (sharedBudget - tokens < 0) {
        skippedRels.push({ text, tokens });
        continue;
      }
      ctx.relationships.push(text);
      sharedBudget -= tokens;
    }

    // 5. Shared procedural knowledge
    const procs = this.proceduralRepo.findAll().slice(0, this.opts.coldLimit);
    for (const p of procs) {
      const text = `Skill "${p.name}": success=${p.success_count} fail=${p.failure_count}`;
      const tokens = this.estimateTokens(text);
      if (sharedBudget - tokens < 0) break;
      ctx.skills.push(text);
      sharedBudget -= tokens;
    }

    // ── Pass 2: Dynamic budget reflow ───────────────────────────────
    // Owner leftover → skipped shared items
    for (const item of [...skippedFacts]) {
      if (ownerBudget - item.tokens >= 0) {
        ctx.relevantFacts.push(item.text);
        ownerBudget -= item.tokens;
      }
    }
    for (const item of [...skippedRels]) {
      if (ownerBudget - item.tokens >= 0) {
        ctx.relationships.push(item.text);
        ownerBudget -= item.tokens;
      }
    }
    // Shared leftover → demoted episodes
    for (const text of demotedEpisodes) {
      const tokens = this.estimateTokens(text);
      if (sharedBudget - tokens >= 0) {
        ctx.recentEpisodes.push(text);
        sharedBudget -= tokens;
      }
    }

    ctx.estimatedTokens = totalBudget - ownerBudget - sharedBudget;
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
    this.episodicRepo.insert({ eventType, content, importance, sessionId, ownerId: this.opts.ownerId });
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

  /** 保存会话摘要 — owned tier: always writes owner_id when set */
  saveSessionSummary(sessionId: string, summary: string, outcome?: string): void {
    this.sessionRepo.upsert(sessionId, summary, outcome, this.opts.ownerId);
    this.logger.debug('Saved session summary', { sessionId, ownerId: this.opts.ownerId });
  }

  /** 保存Soul历史快照 — 需要contentHash */
  saveSoulSnapshot(content: string, contentHash: string, alignmentScore?: number): void {
    this.soulRepo.insert({ content, contentHash, alignmentScore, ownerId: this.opts.ownerId });
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

  /**
   * Dedup helper (Round 15.1 — Goal B): check if episode content
   * substantially overlaps with any already-included session summary.
   * Bidirectional 100-char prefix comparison — explainable and testable.
   */
  private isOverlappingWithSummaries(episodeContent: string, summaries: string[]): boolean {
    if (summaries.length === 0) return false;
    const episodeNorm = episodeContent.toLowerCase().slice(0, 100);
    if (episodeNorm.length < 20) return false; // too short to be meaningful overlap
    for (const summary of summaries) {
      const summaryNorm = summary.toLowerCase();
      // Bidirectional: episode prefix in summary OR summary prefix in episode
      if (summaryNorm.includes(episodeNorm) || episodeNorm.includes(summaryNorm.slice(0, 100))) {
        return true;
      }
    }
    return false;
  }
}
