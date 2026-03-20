/**
 * ExecutionGuard — Re-entry suppression for commitment execution.
 *
 * Provides two-layer protection:
 * 1. Active lock: prevents concurrent execution of the same commitment
 * 2. Terminal blacklist: prevents re-execution of completed/failed/abandoned commitments
 *
 * This is the canonical enforcement point for "execute exactly once" semantics
 * in the resume → execution → completion closed loop.
 *
 * Round 19.2: P1 High-Trust Continuous Autonomy Final Closure
 */
import type { Logger } from '../types/common.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface AcquireResult {
  /** Whether execution is allowed to proceed */
  readonly allowed: boolean;
  /** Reason for denial (if allowed is false) */
  readonly reason?: string;
}

export interface GuardStats {
  /** Number of commitments currently held (active execution) */
  readonly activeCount: number;
  /** Number of commitments permanently blacklisted (terminal) */
  readonly terminalCount: number;
  /** Total acquire attempts */
  readonly acquireAttempts: number;
  /** Total denials */
  readonly deniedCount: number;
}

// ── ExecutionGuard ─────────────────────────────────────────────────────

export class ExecutionGuard {
  /**
   * Active execution locks — a commitmentId is in this set while
   * its execute() closure is running. Prevents concurrent dispatch.
   */
  private activeLocks = new Set<string>();

  /**
   * Terminal blacklist — commitmentIds that have reached a terminal
   * state (completed, failed, abandoned). These are never re-executed.
   */
  private terminalBlacklist = new Set<string>();

  private _acquireAttempts = 0;
  private _deniedCount = 0;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child('execution-guard');
  }

  /**
   * Attempt to acquire execution rights for a commitment.
   *
   * Returns `{ allowed: true }` if execution may proceed.
   * Returns `{ allowed: false, reason }` if the commitment is
   * already executing or has been permanently blacklisted.
   *
   * This is an atomic check-and-set operation.
   */
  tryAcquire(commitmentId: string): AcquireResult {
    this._acquireAttempts++;

    // Layer 1: Terminal blacklist — permanent denial
    if (this.terminalBlacklist.has(commitmentId)) {
      this._deniedCount++;
      this.logger.debug('Guard denied: terminal blacklist', { commitmentId });
      return {
        allowed: false,
        reason: `re-entry-suppressed: commitment ${commitmentId} is in terminal state`,
      };
    }

    // Layer 2: Active lock — concurrent execution denial
    if (this.activeLocks.has(commitmentId)) {
      this._deniedCount++;
      this.logger.debug('Guard denied: active lock', { commitmentId });
      return {
        allowed: false,
        reason: `concurrent-execution-blocked: commitment ${commitmentId} is already executing`,
      };
    }

    // Acquire the lock
    this.activeLocks.add(commitmentId);
    this.logger.debug('Guard acquired', { commitmentId });
    return { allowed: true };
  }

  /**
   * Release the execution lock for a commitment.
   *
   * @param commitmentId - The commitment being released
   * @param terminal - If true, the commitment is permanently blacklisted
   *                   (completed/failed/abandoned — never execute again)
   */
  release(commitmentId: string, terminal: boolean): void {
    this.activeLocks.delete(commitmentId);

    if (terminal) {
      this.terminalBlacklist.add(commitmentId);
      this.logger.debug('Guard released + blacklisted', { commitmentId });
    } else {
      this.logger.debug('Guard released', { commitmentId });
    }
  }

  /**
   * Check if a commitment is currently locked (active execution).
   */
  isActive(commitmentId: string): boolean {
    return this.activeLocks.has(commitmentId);
  }

  /**
   * Check if a commitment has been permanently blacklisted.
   */
  isTerminal(commitmentId: string): boolean {
    return this.terminalBlacklist.has(commitmentId);
  }

  /**
   * Get diagnostic statistics.
   */
  stats(): GuardStats {
    return {
      activeCount: this.activeLocks.size,
      terminalCount: this.terminalBlacklist.size,
      acquireAttempts: this._acquireAttempts,
      deniedCount: this._deniedCount,
    };
  }

  /**
   * Clear all state (for testing or full reset).
   */
  clear(): void {
    this.activeLocks.clear();
    this.terminalBlacklist.clear();
    this._acquireAttempts = 0;
    this._deniedCount = 0;
  }
}
