/**
 * Doctor Check — Identity Coherence
 *
 * Validates the Identity-Memory Coherence Baseline:
 * 1. identity-anchor-exists: at least one IdentityAnchor in DB
 * 2. continuity-chain-valid: ContinuityRecord hash chain is unbroken
 * 3. soul-anchor-aligned: current SOUL hash matches latest continuity record
 */
import type Database from 'better-sqlite3';
import type { CheckResult } from '../index.js';
import { IdentityAnchorRepository, ContinuityRecordRepository } from '../../identity/anchor.repo.js';
import { verifyContinuityChain, sha256 } from '../../identity/anchor.js';
import type { SelfState } from '../../identity/continuity-service.js';

/**
 * Run identity coherence checks against the database.
 * @param db - The agent database
 * @param currentSoulContent — the current SOUL.md content (if available)
 */
export function checkIdentityCoherence(
  db: Database.Database,
  currentSoulContent?: string,
  selfState?: SelfState,
): CheckResult[] {
  const results: CheckResult[] = [];
  const anchorRepo = new IdentityAnchorRepository(db);
  const recordRepo = new ContinuityRecordRepository(db);

  // ── Check 1: Identity anchor exists ──────────────────────────────────
  const anchorCount = anchorRepo.count();
  if (anchorCount === 0) {
    results.push({
      id: 'identity-anchor-exists',
      label: 'Identity Anchor',
      category: 'identity',
      status: 'warn',
      severity: 'warning',
      summary: 'No identity anchor found — agent identity not yet bootstrapped',
      evidence: 'identity_anchor table is empty',
      confidence: 'high',
      evidenceType: 'runtime-probe',
    });
  } else {
    const anchor = anchorRepo.findFirst();
    results.push({
      id: 'identity-anchor-exists',
      label: 'Identity Anchor',
      category: 'identity',
      status: 'pass',
      severity: 'info',
      summary: `Identity anchor present: ${anchor?.name ?? 'unknown'} (${anchor?.id.slice(0, 8)}...)`,
      evidence: `identity_anchor table has ${anchorCount} row(s)`,
      confidence: 'high',
      evidenceType: 'runtime-probe',
    });
  }

  // ── Check 2: Continuity chain valid ──────────────────────────────────
  const records = recordRepo.findAll();
  if (records.length === 0) {
    results.push({
      id: 'continuity-chain-valid',
      label: 'Continuity Chain',
      category: 'identity',
      status: 'warn',
      severity: 'warning',
      summary: 'No continuity records — chain not yet initialized',
      evidence: 'continuity_records table is empty',
      confidence: 'high',
      evidenceType: 'runtime-probe',
    });
  } else {
    const verification = verifyContinuityChain(records);
    if (verification.valid) {
      results.push({
        id: 'continuity-chain-valid',
        label: 'Continuity Chain',
        category: 'identity',
        status: 'pass',
        severity: 'info',
        summary: `Continuity chain valid: ${verification.length} record(s)`,
        evidence: `All ${verification.length} records hash-chain verified`,
        confidence: 'high',
        evidenceType: 'runtime-probe',
      });
    } else {
      results.push({
        id: 'continuity-chain-valid',
        label: 'Continuity Chain',
        category: 'identity',
        status: 'fail',
        severity: 'blocker',
        summary: `Continuity chain BROKEN at version ${verification.brokenAtVersion}`,
        evidence: verification.reason ?? 'Hash chain verification failed',
        confidence: 'high',
        evidenceType: 'runtime-probe',
      });
    }
  }

  // ── Check 3: Soul-anchor alignment ───────────────────────────────────
  if (currentSoulContent && records.length > 0) {
    const latestRecord = records[records.length - 1]!;
    const currentHash = sha256(currentSoulContent);
    if (currentHash === latestRecord.soulHash) {
      results.push({
        id: 'soul-anchor-aligned',
        label: 'Soul-Anchor Alignment',
        category: 'identity',
        status: 'pass',
        severity: 'info',
        summary: 'Current SOUL hash matches latest continuity record',
        evidence: `Hash: ${currentHash.slice(0, 16)}...`,
        confidence: 'high',
        evidenceType: 'runtime-probe',
      });
    } else {
      results.push({
        id: 'soul-anchor-aligned',
        label: 'Soul-Anchor Alignment',
        category: 'identity',
        status: 'warn',
        severity: 'warning',
        summary: 'SOUL has changed since last continuity record — advance the chain',
        evidence: `Current: ${currentHash.slice(0, 16)}... vs Record: ${latestRecord.soulHash.slice(0, 16)}...`,
        confidence: 'high',
        evidenceType: 'runtime-probe',
      });
    }
  } else if (!currentSoulContent) {
    results.push({
      id: 'soul-anchor-aligned',
      label: 'Soul-Anchor Alignment',
      category: 'identity',
      status: 'warn',
      severity: 'warning',
      summary: 'No SOUL content provided — cannot check alignment',
      evidence: 'SOUL content not available at check time',
      confidence: 'low',
      evidenceType: 'code-inspection',
    });
  }

  // ── Check 4: Runtime self-state consistency ──────────────────────────
  if (selfState) {
    const issues: string[] = [];

    // Verify chainValid matches DB evidence
    const dbChainValid = records.length === 0 || verifyContinuityChain(records).valid;
    if (selfState.chainValid !== dbChainValid) {
      issues.push(`chainValid mismatch: runtime=${selfState.chainValid}, DB=${dbChainValid}`);
    }

    // Verify soulDrifted matches actual hash comparison
    if (currentSoulContent && records.length > 0) {
      const latestRecord = records[records.length - 1]!;
      const currentHash = sha256(currentSoulContent);
      const actualDrifted = currentHash !== latestRecord.soulHash;
      if (selfState.soulDrifted !== actualDrifted) {
        issues.push(`soulDrifted mismatch: runtime=${selfState.soulDrifted}, actual=${actualDrifted}`);
      }
    }

    // Verify chainLength matches DB
    if (selfState.chainLength !== records.length) {
      issues.push(`chainLength mismatch: runtime=${selfState.chainLength}, DB=${records.length}`);
    }

    if (issues.length === 0) {
      results.push({
        id: 'runtime-self-state-consistent',
        label: 'Runtime Self-State Consistency',
        category: 'identity',
        status: 'pass',
        severity: 'info',
        summary: `Runtime self-model verified: mode=${selfState.mode}, chainValid=${selfState.chainValid}, chainLength=${selfState.chainLength}`,
        evidence: `All runtime beliefs match DB evidence. Basis: ${selfState.explanation.continuityBasis}`,
        confidence: 'high',
        evidenceType: 'runtime-probe',
      });
    } else {
      results.push({
        id: 'runtime-self-state-consistent',
        label: 'Runtime Self-State Consistency',
        category: 'identity',
        status: 'fail',
        severity: 'blocker',
        summary: `Runtime self-model DIVERGED from DB evidence (${issues.length} issue(s))`,
        evidence: issues.join('; '),
        confidence: 'high',
        evidenceType: 'runtime-probe',
      });
    }
  }

  return results;
}
