/**
 * ConversationService — 会话状态业务层
 *
 * 封装 SessionsRepository + TurnsRepository，提供：
 *   - turn 追加（自动 upsert session）
 *   - LLM 上下文构造
 *   - transcript 查询
 *   - session 管理
 */
import type { Message } from '../../types/common.js';
import type { Cents } from '../../types/common.js';
import { ZERO_CENTS } from '../../types/common.js';
import type { TurnsRepository, TurnRow, InsertTurn } from '../../state/repos/turns.js';
import type { SessionsRepository, SessionRow, SessionWithCount } from '../../state/repos/sessions.js';

// ── Constants ────────────────────────────────────────────

/** Maximum characters for auto-generated session title */
const AUTO_TITLE_MAX_CHARS = 50;

/** Default context window size (number of turns) */
const DEFAULT_CONTEXT_TURNS = 20;

// ── Types ────────────────────────────────────────────────

export interface AppendTurnOptions {
  readonly sessionId: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly thinking?: string;
  readonly toolCallsJson?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly costCents?: Cents;
  readonly model?: string;
  readonly channel?: string;
}

export interface ContextOptions {
  /** Max number of turns to include (default: 20) */
  readonly maxTurns?: number;
  /** System prompt to prepend */
  readonly systemPrompt?: string;
}

// ── Service ──────────────────────────────────────────────

export class ConversationService {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly turns: TurnsRepository,
  ) {}

  // ── Turn Operations ─────────────────────────────────────

  /**
   * Append a turn to a session.
   * Automatically creates the session if it doesn't exist yet.
   */
  appendTurn(opts: AppendTurnOptions): number {
    // Ensure session exists
    this.sessions.upsert(opts.sessionId, opts.channel ?? 'webchat');

    // Insert turn
    const turnId = this.turns.insert({
      sessionId: opts.sessionId,
      role: opts.role,
      content: opts.content,
      thinking: opts.thinking,
      toolCallsJson: opts.toolCallsJson,
      inputTokens: opts.inputTokens ?? 0,
      outputTokens: opts.outputTokens ?? 0,
      costCents: opts.costCents ?? ZERO_CENTS,
      model: opts.model,
    });

    // Auto-set title from first user message (if no title yet)
    if (opts.role === 'user') {
      this.autoTitle(opts.sessionId);
    }

    // Touch session updated_at
    this.sessions.touch(opts.sessionId);

    return turnId;
  }

  // ── Context Construction ────────────────────────────────

  /**
   * Build LLM context messages from session history.
   * Returns the most recent N turns as Message[], optionally with a system prompt.
   */
  buildContext(sessionId: string, options?: ContextOptions): Message[] {
    const maxTurns = options?.maxTurns ?? DEFAULT_CONTEXT_TURNS;
    const allTurns = this.turns.findBySession(sessionId);

    // Take the most recent N turns
    const recentTurns = allTurns.slice(-maxTurns);

    const messages: Message[] = [];

    // Prepend system prompt if provided
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    // Convert turns to messages
    for (const turn of recentTurns) {
      messages.push({
        role: turn.role as 'user' | 'assistant',
        content: turn.content ?? '',
      });
    }

    return messages;
  }

  // ── Transcript ──────────────────────────────────────────

  /**
   * Get the complete transcript for a session.
   */
  getTranscript(sessionId: string): readonly TurnRow[] {
    return this.turns.findBySession(sessionId);
  }

  // ── Session Management ──────────────────────────────────

  /**
   * List sessions with message counts.
   */
  listSessions(limit?: number, offset?: number): readonly SessionWithCount[] {
    return this.sessions.listWithCount(limit, offset);
  }

  /**
   * Get a single session by ID.
   */
  getSession(sessionId: string): SessionRow | undefined {
    return this.sessions.findById(sessionId);
  }

  /**
   * Update session title.
   */
  updateTitle(sessionId: string, title: string): boolean {
    return this.sessions.updateTitle(sessionId, title);
  }

  /**
   * Delete a session and all its turns.
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Get total session count.
   */
  sessionCount(): number {
    return this.sessions.count();
  }

  // ── Internal ────────────────────────────────────────────

  /**
   * Auto-generate title from the first user message if no title exists yet.
   * Uses the first `AUTO_TITLE_MAX_CHARS` chars of the first user message.
   */
  private autoTitle(sessionId: string): void {
    const session = this.sessions.findById(sessionId);
    if (!session || session.title) return; // already has title

    const turns = this.turns.findBySession(sessionId);
    const firstUser = turns.find((t) => t.role === 'user');
    if (!firstUser?.content) return;

    const title = firstUser.content.length > AUTO_TITLE_MAX_CHARS
      ? firstUser.content.slice(0, AUTO_TITLE_MAX_CHARS) + '…'
      : firstUser.content;

    this.sessions.updateTitle(sessionId, title);
  }
}
