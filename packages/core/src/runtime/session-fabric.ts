/**
 * SessionFabric — Round 19.2 G4
 *
 * Multi-session orchestration, lifecycle, and control plane for ConShell.
 * Absorbs core control-plane capabilities from external orchestrators.
 *
 * Manages:
 * 1. SESSION LIFECYCLE — create, pause, resume, terminate sessions
 * 2. CHANNEL BINDING — bind sessions to channels (webchat, MCP, API)
 * 3. RUNTIME WORKERS — track active workers per session
 * 4. ORCHESTRATION — coordinate multi-session execution
 * 5. CONTROL SEMANTICS — operator-level control (pause-all, drain, etc.)
 *
 * "A sovereign agent must own its own control plane."
 */
import type { Logger } from '../types/common.js';

// ── Session Types ───────────────────────────────────────────────────

export type SessionStatus = 'active' | 'paused' | 'draining' | 'terminated' | 'error';
export type ChannelKind = 'webchat' | 'mcp' | 'api' | 'internal' | 'cron';

export interface Session {
  readonly id: string;
  readonly name: string;
  status: SessionStatus;
  readonly channelKind: ChannelKind;
  readonly channelId?: string;

  /** Active worker count for this session */
  activeWorkers: number;
  /** Maximum concurrent workers */
  readonly maxWorkers: number;

  /** Linked agent ID (for multi-agent) */
  readonly agentId: string;

  /** Session-level metadata */
  metadata: Record<string, unknown>;

  readonly createdAt: string;
  lastActivityAt: string;
  terminatedAt?: string;
  terminatedReason?: string;
}

export interface SessionCreateInput {
  name: string;
  channelKind: ChannelKind;
  channelId?: string;
  agentId?: string;
  maxWorkers?: number;
  metadata?: Record<string, unknown>;
}

// ── Control Commands ────────────────────────────────────────────────

export type ControlCommand =
  | 'pause'
  | 'resume'
  | 'drain'        // stop accepting new work, finish current
  | 'terminate'
  | 'pause_all'    // operator: pause entire fabric
  | 'resume_all'
  | 'drain_all';

export interface ControlReceipt {
  readonly command: ControlCommand;
  readonly targetSessionId?: string;
  readonly affectedCount: number;
  readonly timestamp: string;
  readonly success: boolean;
  readonly reason?: string;
}

// ── SessionFabric ───────────────────────────────────────────────────

export class SessionFabric {
  private sessions = new Map<string, Session>();
  private controlLog: ControlReceipt[] = [];
  private idCounter = 0;
  private fabricPaused = false;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  // ── Session Lifecycle ─────────────────────────────────────────────

  createSession(input: SessionCreateInput): Session {
    if (this.fabricPaused) {
      throw new Error('SessionFabric is paused — cannot create new sessions');
    }

    const id = `ses_${++this.idCounter}`;
    const now = new Date().toISOString();

    const session: Session = {
      id,
      name: input.name,
      status: 'active',
      channelKind: input.channelKind,
      channelId: input.channelId,
      activeWorkers: 0,
      maxWorkers: input.maxWorkers ?? 4,
      agentId: input.agentId ?? 'self',
      metadata: input.metadata ?? {},
      createdAt: now,
      lastActivityAt: now,
    };

    this.sessions.set(id, session);
    this.logger.info('Session created', { id, name: input.name, channel: input.channelKind });
    return session;
  }

  pauseSession(id: string): ControlReceipt {
    return this.executeControl('pause', id);
  }

  resumeSession(id: string): ControlReceipt {
    return this.executeControl('resume', id);
  }

  drainSession(id: string): ControlReceipt {
    return this.executeControl('drain', id);
  }

  terminateSession(id: string, reason?: string): ControlReceipt {
    const session = this.sessions.get(id);
    if (session) {
      session.terminatedReason = reason;
    }
    return this.executeControl('terminate', id);
  }

  // ── Worker Management ─────────────────────────────────────────────

  acquireWorker(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (session.status !== 'active') return false;
    if (session.activeWorkers >= session.maxWorkers) return false;

    session.activeWorkers++;
    session.lastActivityAt = new Date().toISOString();
    return true;
  }

  releaseWorker(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.activeWorkers = Math.max(0, session.activeWorkers - 1);

    // Auto-terminate draining sessions with no workers
    if (session.status === 'draining' && session.activeWorkers === 0) {
      session.status = 'terminated';
      session.terminatedAt = new Date().toISOString();
      session.terminatedReason = 'drain-complete';
    }
  }

  // ── Operator Control ──────────────────────────────────────────────

  pauseAll(): ControlReceipt {
    return this.executeBulkControl('pause_all');
  }

  resumeAll(): ControlReceipt {
    return this.executeBulkControl('resume_all');
  }

  drainAll(): ControlReceipt {
    return this.executeBulkControl('drain_all');
  }

  // ── Queries ───────────────────────────────────────────────────────

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  activeSessions(): Session[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active');
  }

  allSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  controlHistory(): readonly ControlReceipt[] {
    return this.controlLog;
  }

  isPaused(): boolean {
    return this.fabricPaused;
  }

  stats() {
    const all = Array.from(this.sessions.values());
    return {
      total: all.length,
      active: all.filter(s => s.status === 'active').length,
      paused: all.filter(s => s.status === 'paused').length,
      draining: all.filter(s => s.status === 'draining').length,
      terminated: all.filter(s => s.status === 'terminated').length,
      totalWorkers: all.reduce((sum, s) => sum + s.activeWorkers, 0),
      fabricPaused: this.fabricPaused,
    };
  }

  // ── Private ───────────────────────────────────────────────────────

  private executeControl(command: ControlCommand, sessionId: string): ControlReceipt {
    const session = this.sessions.get(sessionId);
    const now = new Date().toISOString();

    if (!session) {
      const receipt: ControlReceipt = { command, targetSessionId: sessionId, affectedCount: 0, timestamp: now, success: false, reason: 'Session not found' };
      this.controlLog.push(receipt);
      return receipt;
    }

    let success = true;
    switch (command) {
      case 'pause':
        if (session.status === 'active') session.status = 'paused';
        else success = false;
        break;
      case 'resume':
        if (session.status === 'paused') session.status = 'active';
        else success = false;
        break;
      case 'drain':
        if (session.status === 'active' || session.status === 'paused') session.status = 'draining';
        else success = false;
        break;
      case 'terminate':
        if (session.status !== 'terminated') {
          session.status = 'terminated';
          session.terminatedAt = now;
        } else success = false;
        break;
    }

    const receipt: ControlReceipt = { command, targetSessionId: sessionId, affectedCount: success ? 1 : 0, timestamp: now, success };
    this.controlLog.push(receipt);
    this.logger.info('Session control', { command, sessionId, success });
    return receipt;
  }

  private executeBulkControl(command: ControlCommand): ControlReceipt {
    const now = new Date().toISOString();
    let affected = 0;

    for (const session of this.sessions.values()) {
      switch (command) {
        case 'pause_all':
          if (session.status === 'active') { session.status = 'paused'; affected++; }
          break;
        case 'resume_all':
          if (session.status === 'paused') { session.status = 'active'; affected++; }
          break;
        case 'drain_all':
          if (session.status === 'active' || session.status === 'paused') { session.status = 'draining'; affected++; }
          break;
      }
    }

    if (command === 'pause_all') this.fabricPaused = true;
    if (command === 'resume_all') this.fabricPaused = false;

    const receipt: ControlReceipt = { command, affectedCount: affected, timestamp: now, success: true };
    this.controlLog.push(receipt);
    this.logger.info('Bulk control', { command, affected });
    return receipt;
  }
}
