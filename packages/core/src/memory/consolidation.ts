/**
 * ConsolidationPipeline — Session-to-Episodic Memory Consolidation (Phase 2 — P2-4)
 *
 * Promotes salient session turns into durable episodic memory.
 * Designed for V1 simplicity — heuristic-based salience scoring.
 * Future versions will add semantic extraction, relationship discovery, etc.
 */
import type Database from 'better-sqlite3';
import type { Logger } from '../types/common.js';
import {
  WorkingMemoryRepository,
  EpisodicMemoryRepository,
  SessionSummariesRepository,
  type WorkingMemoryRow,
} from '../state/repos/memory.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface ConsolidationOptions {
  /** Minimum salience score to promote a turn (0–10, default 3) */
  salienceThreshold?: number;
  /** Maximum episodes to generate per session (default 10) */
  maxEpisodesPerSession?: number;
}

export interface ConsolidationResult {
  sessionId: string;
  ownerId: string | undefined;
  turnsProcessed: number;
  episodesCreated: number;
  /** Whether this session was already consolidated */
  skipped: boolean;
}

// ── Salience heuristics ──────────────────────────────────────────────

/**
 * Score a working-memory turn for salience (0–10).
 * Heuristic factors:
 *  - Long responses (>200 chars) → +2
 *  - Tool-related turns (type contains 'tool') → +3
 *  - Error signals in content → +2
 *  - Assistant summary turns → +1
 */
function scoreSalience(turn: WorkingMemoryRow): number {
  let score = 1; // baseline

  // Length bonus: rich content is more salient
  if (turn.content.length > 200) score += 2;
  if (turn.content.length > 500) score += 1;

  // Tool usage is highly salient — captures agent capabilities
  if (turn.type.includes('tool') || /tool_call|function_call/i.test(turn.content)) {
    score += 3;
  }

  // Error signals — important for learning
  if (/error|fail|exception|crash|bug/i.test(turn.content)) {
    score += 2;
  }

  // Decision markers
  if (/decided|conclusion|therefore|in summary/i.test(turn.content)) {
    score += 1;
  }

  return Math.min(score, 10);
}

// ── Pipeline ─────────────────────────────────────────────────────────

export class ConsolidationPipeline {
  private logger: Logger;
  private opts: Required<ConsolidationOptions>;
  private workingRepo: WorkingMemoryRepository;
  private episodicRepo: EpisodicMemoryRepository;
  private sessionRepo: SessionSummariesRepository;

  constructor(db: Database.Database, logger: Logger, opts?: ConsolidationOptions) {
    this.logger = logger.child('consolidation');
    this.opts = {
      salienceThreshold: opts?.salienceThreshold ?? 3,
      maxEpisodesPerSession: opts?.maxEpisodesPerSession ?? 10,
    };
    this.workingRepo = new WorkingMemoryRepository(db);
    this.episodicRepo = new EpisodicMemoryRepository(db);
    this.sessionRepo = new SessionSummariesRepository(db);
  }

  /**
   * Consolidate a session's turns into episodic memory.
   *
   * 1. Check if session is already consolidated (session summary exists)
   * 2. Read all working-memory turns for the session
   * 3. Score each turn for salience
   * 4. Promote salient turns to episodic memory with ownerId
   * 5. Return consolidation result
   *
   * Note: This does NOT mark the session as "consolidated" — that happens
   * when the caller saves a session summary via MemoryTierManager.
   */
  consolidateSession(sessionId: string, ownerId?: string): ConsolidationResult {
    const result: ConsolidationResult = {
      sessionId,
      ownerId,
      turnsProcessed: 0,
      episodesCreated: 0,
      skipped: false,
    };

    // 1. Check for existing session summary (already consolidated indicator)
    const existing = this.sessionRepo.findBySession(sessionId);
    if (existing) {
      this.logger.debug('Session already consolidated, checking for new turns', { sessionId });
    }

    // 2. Read all working-memory turns
    const turns = this.workingRepo.findBySession(sessionId);
    result.turnsProcessed = turns.length;

    if (turns.length === 0) {
      this.logger.debug('No turns to consolidate', { sessionId });
      result.skipped = true;
      return result;
    }

    // 3. Score and filter
    const salientTurns = turns
      .map(turn => ({ turn, salience: scoreSalience(turn) }))
      .filter(({ salience }) => salience >= this.opts.salienceThreshold)
      .sort((a, b) => b.salience - a.salience)
      .slice(0, this.opts.maxEpisodesPerSession);

    // 4. Promote to episodic memory (with dedup guard — Round 15.1)
    for (const { turn, salience } of salientTurns) {
      const eventType = `consolidated_${turn.type}`;
      const content = turn.content.slice(0, 1000); // cap length

      // Dedup: skip if episode with same session + type + content prefix already exists
      if (this.episodicRepo.existsBySessionAndContent(sessionId, eventType, content)) {
        this.logger.debug('Skipped duplicate episode', { sessionId, eventType });
        continue;
      }

      this.episodicRepo.insert({
        eventType,
        content,
        importance: salience,
        sessionId,
        ownerId,
      });
      result.episodesCreated++;
    }

    this.logger.info('Session consolidated', {
      sessionId,
      ownerId,
      turnsProcessed: result.turnsProcessed,
      episodesCreated: result.episodesCreated,
    });

    return result;
  }
}

// ── Exported helper for testing ───────────────────────────────────────
export { scoreSalience as _scoreSalience };
