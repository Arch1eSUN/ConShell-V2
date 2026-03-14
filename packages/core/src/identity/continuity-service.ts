/**
 * ContinuityService — Runtime bridge for Identity ↔ Continuity
 *
 * This is the missing link between the static data structures
 * (IdentityAnchor, ContinuityRecord) and the living runtime.
 *
 * Responsibilities:
 * 1. Hydrate self-state on boot (genesis or restart)
 * 2. Advance continuity chain on soul evolution
 * 3. Advance continuity chain on session finalize
 * 4. Expose current self-state to runtime/doctor
 * 5. Detect and report broken continuity (degraded mode)
 */
import type Database from 'better-sqlite3';
import type { Logger } from '../types/common.js';
import {
  createIdentityAnchor,
  createContinuityRecord,
  advanceContinuityRecord,
  verifyContinuityChain,
  sha256,
  type IdentityAnchor,
  type ContinuityRecord,
  type ChainVerificationResult,
} from './anchor.js';
import { IdentityAnchorRepository, ContinuityRecordRepository } from './anchor.repo.js';

// ── Types ──────────────────────────────────────────────────────────────

/**
 * The runtime's understanding of "who am I right now."
 */
export type SelfMode = 'genesis' | 'restart' | 'degraded';

/**
 * Structured explanation of why the system believes it is (or isn't)
 * the same self across restarts. This replaces ad-hoc string reasons
 * with a machine-readable + human-readable structure.
 */
export interface SelfExplanation {
  /** The basis for continuity belief */
  continuityBasis: 'chain-valid' | 'chain-broken-but-anchor-exists' | 'fresh-genesis';
  /** Whether the current soul content has drifted from the latest record */
  soulDrifted: boolean;
  /** Human-readable summary */
  summary: string;
}

export interface SelfState {
  /** Current boot mode */
  mode: SelfMode;
  /** The stable identity (always present after hydration) */
  anchor: IdentityAnchor;
  /** Latest continuity record (may be genesis or latest in chain) */
  latestRecord: ContinuityRecord;
  /** Whether the full chain verified correctly */
  chainValid: boolean;
  /** Chain length */
  chainLength: number;
  /** Whether the current soul content differs from latest record's soulHash */
  soulDrifted: boolean;
  /** Structured self-explanation (Round 14.8) */
  explanation: SelfExplanation;
  /** If chain is broken, the reason (kept for backward compat) */
  chainBreakReason?: string;
}

// ── ContinuityService ──────────────────────────────────────────────────

export class ContinuityService {
  private logger: Logger;
  private anchorRepo: IdentityAnchorRepository;
  private recordRepo: ContinuityRecordRepository;
  private state: SelfState | null = null;

  constructor(db: Database.Database, logger: Logger) {
    this.logger = logger.child('continuity');
    this.anchorRepo = new IdentityAnchorRepository(db);
    this.recordRepo = new ContinuityRecordRepository(db);
  }

  /**
   * Hydrate the agent's self-state from persistent storage.
   * This is the single entry point for "who am I?" at boot time.
   *
   * @returns SelfState — the runtime's understanding of itself
   */
  hydrate(params: {
    soulContent: string;
    soulName: string;
    walletAddress?: string | null;
  }): SelfState {
    const existingAnchor = this.anchorRepo.findFirst();

    if (!existingAnchor) {
      // ── Genesis: first boot ever ──
      return this.performGenesis(params);
    }

    // ── Restart: returning self ──
    return this.performRestart(existingAnchor, params.soulContent);
  }

  /**
   * Advance the continuity chain after a soul evolution.
   */
  advanceForSoulChange(soulContent: string, soulVersion: number): ContinuityRecord {
    this.ensureHydrated();
    const latest = this.state!.latestRecord;
    const record = advanceContinuityRecord({
      previous: latest,
      soulContent,
      soulVersion,
    });
    this.recordRepo.insert(record);
    this.state!.latestRecord = record;
    this.state!.chainLength++;
    this.refreshPostAdvance(soulContent);
    this.logger.info('Continuity advanced (soul change)', {
      version: record.version,
      soulVersion,
    });
    return record;
  }

  /**
   * Check whether a session finalize warrants a continuity advance.
   * Only advance when session count or memory episode count actually changed.
   * This prevents version inflation from redundant session finalizes.
   */
  shouldAdvanceForSession(params: {
    sessionCount: number;
    memoryEpisodeCount?: number;
  }): boolean {
    this.ensureHydrated();
    const latest = this.state!.latestRecord;
    if (params.sessionCount !== latest.sessionCount) return true;
    if (params.memoryEpisodeCount !== undefined &&
        params.memoryEpisodeCount !== latest.memoryEpisodeCount) return true;
    return false;
  }

  /**
   * Advance the continuity chain after a session finalizes.
   * Use shouldAdvanceForSession() first to check if advance is warranted.
   */
  advanceForSession(params: {
    soulContent: string;
    sessionId: string;
    sessionCount: number;
    memoryEpisodeCount?: number;
  }): ContinuityRecord {
    this.ensureHydrated();
    const latest = this.state!.latestRecord;
    const record = advanceContinuityRecord({
      previous: latest,
      soulContent: params.soulContent,
      sessionCount: params.sessionCount,
      lastSessionId: params.sessionId,
      memoryEpisodeCount: params.memoryEpisodeCount,
    });
    this.recordRepo.insert(record);
    this.state!.latestRecord = record;
    this.state!.chainLength++;
    this.refreshPostAdvance(params.soulContent);
    this.logger.info('Continuity advanced (session)', {
      version: record.version,
      sessionId: params.sessionId,
      sessionCount: params.sessionCount,
    });
    return record;
  }

  /**
   * Get the current runtime self-state.
   * Returns null if hydrate() hasn't been called.
   */
  getCurrentState(): SelfState | null {
    return this.state;
  }

  /**
   * Whether the service has been hydrated successfully.
   */
  get hydrated(): boolean {
    return this.state !== null;
  }

  // ── Private ────────────────────────────────────────────────────────

  /**
   * Refresh derived SelfState fields after any advance.
   * Ensures soulDrifted and explanation stay consistent with latest record.
   */
  private refreshPostAdvance(currentSoulContent: string): void {
    const s = this.state!;
    const currentHash = sha256(currentSoulContent);
    s.soulDrifted = currentHash !== s.latestRecord.soulHash;
    s.explanation = {
      continuityBasis: s.chainValid ? 'chain-valid' : 'chain-broken-but-anchor-exists',
      soulDrifted: s.soulDrifted,
      summary: `Chain advanced to v${s.latestRecord.version} (${s.chainLength} records). ${s.soulDrifted ? 'Soul content still drifted from latest record.' : 'Soul content matches latest record.'}`,
    };
  }

  private performGenesis(params: {
    soulContent: string;
    soulName: string;
    walletAddress?: string | null;
  }): SelfState {
    const anchor = createIdentityAnchor({
      name: params.soulName,
      soulContent: params.soulContent,
      walletAddress: params.walletAddress,
    });
    this.anchorRepo.insert(anchor);

    const record = createContinuityRecord({
      anchor,
      soulContent: params.soulContent,
    });
    this.recordRepo.insert(record);

    this.state = {
      mode: 'genesis',
      anchor,
      latestRecord: record,
      chainValid: true,
      chainLength: 1,
      soulDrifted: false,
      explanation: {
        continuityBasis: 'fresh-genesis',
        soulDrifted: false,
        summary: `Fresh genesis: identity ${anchor.id.slice(0, 8)} created with soul "${anchor.name}". No prior self exists.`,
      },
    };

    this.logger.info('Genesis: new self created', {
      id: anchor.id,
      name: anchor.name,
      soulHash: anchor.soulHash,
    });

    return this.state;
  }

  private performRestart(
    anchor: IdentityAnchor,
    soulContent: string,
  ): SelfState {
    const chain = this.recordRepo.findAll();
    const latest = this.recordRepo.findLatest();

    if (!latest || chain.length === 0) {
      // Anchor exists but no continuity records — degraded but recoverable
      this.logger.warn('Restart: anchor exists but no continuity records, creating recovery record');
      const record = createContinuityRecord({
        anchor,
        soulContent,
      });
      this.recordRepo.insert(record);
      this.state = {
        mode: 'degraded',
        anchor,
        latestRecord: record,
        chainValid: false,
        chainLength: 1,
        soulDrifted: false,
        explanation: {
          continuityBasis: 'chain-broken-but-anchor-exists',
          soulDrifted: false,
          summary: `Degraded restart: anchor ${anchor.id.slice(0, 8)} exists but had no continuity records. A recovery record was created. Identity is preserved but history is incomplete.`,
        },
        chainBreakReason: 'Anchor existed without continuity records — recovery record created',
      };
      return this.state;
    }

    // Verify the chain
    const verification: ChainVerificationResult = verifyContinuityChain(chain);

    // Detect soul drift: current soul content differs from latest record
    const currentSoulHash = sha256(soulContent);
    const soulDrifted = currentSoulHash !== latest.soulHash;

    if (!verification.valid) {
      this.logger.error('Restart: continuity chain BROKEN', {
        brokenAt: verification.brokenAtVersion,
        reason: verification.reason,
      });
      this.state = {
        mode: 'degraded',
        anchor,
        latestRecord: latest,
        chainValid: false,
        chainLength: chain.length,
        soulDrifted,
        explanation: {
          continuityBasis: 'chain-broken-but-anchor-exists',
          soulDrifted,
          summary: `Degraded restart: anchor ${anchor.id.slice(0, 8)} exists but continuity chain is broken at v${verification.brokenAtVersion}. ${soulDrifted ? 'Soul content has drifted since last record.' : 'Soul content matches last record.'} Reason: ${verification.reason}`,
        },
        chainBreakReason: verification.reason,
      };
      return this.state;
    }

    // Valid restart — same self continues
    if (soulDrifted) {
      this.logger.warn('Restart: soul content has drifted since last continuity record', {
        lastRecordSoulHash: latest.soulHash.slice(0, 12),
        currentSoulHash: currentSoulHash.slice(0, 12),
      });
    }

    this.state = {
      mode: 'restart',
      anchor,
      latestRecord: latest,
      chainValid: true,
      chainLength: chain.length,
      soulDrifted,
      explanation: {
        continuityBasis: 'chain-valid',
        soulDrifted,
        summary: `Valid restart: identity ${anchor.id.slice(0, 8)} restored with ${chain.length}-record chain (v1→v${latest.version}). ${soulDrifted ? 'Note: soul content has drifted since last record — consider advancing continuity.' : 'Soul content matches last record.'}`,
      },
    };

    this.logger.info('Restart: same self restored', {
      id: anchor.id,
      name: anchor.name,
      chainLength: chain.length,
      latestVersion: latest.version,
      soulDrifted,
    });

    return this.state;
  }

  private ensureHydrated(): void {
    if (!this.state) {
      throw new Error('ContinuityService not hydrated — call hydrate() first');
    }
  }
}
