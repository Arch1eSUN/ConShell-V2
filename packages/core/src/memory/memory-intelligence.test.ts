/**
 * memory-intelligence.test.ts — Round 15.1 / 15.1.1 Quality Tests
 *
 * Proves the memory intelligence improvements:
 * Round 15.1: episodes in prompt, blended scoring, consolidation dedup
 * Round 15.1.1: dynamic budget reflow, soft dedup, continuity scoring, categorized rendering
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase } from '../state/database.js';
import { MemoryTierManager } from '../memory/tier-manager.js';
import { ConsolidationPipeline } from '../memory/consolidation.js';
import {
  EpisodicMemoryRepository,
  WorkingMemoryRepository,
} from '../state/repos/memory.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

const noop = () => {};
const silentLogger = {
  info: noop, debug: noop, warn: noop, error: noop,
  child: () => silentLogger,
} as any;

function freshDb(): Database.Database {
  const agentHome = join(tmpdir(), `conshell-test-${randomUUID()}`);
  mkdirSync(agentHome, { recursive: true });
  return openDatabase({ agentHome, logger: silentLogger });
}

// ── Test Suite ─────────────────────────────────────────────────────────

describe('Memory Intelligence (Round 15.1)', () => {
  let db: Database.Database;
  let episodicRepo: EpisodicMemoryRepository;

  beforeEach(() => {
    db = freshDb();
    episodicRepo = new EpisodicMemoryRepository(db);
  });

  // ── 1. Episodes reach the tier manager ─────────────────────────────

  describe('episodes in buildContext()', () => {
    it('includes episodic memories in MemoryContext', () => {
      const manager = new MemoryTierManager(db, silentLogger);
      manager.storeEpisode('observation', 'User prefers dark mode', 8, 'sess-1');
      const ctx = manager.buildContext();
      expect(ctx.recentEpisodes.length).toBeGreaterThanOrEqual(1);
      expect(ctx.recentEpisodes[0]).toContain('User prefers dark mode');
    });

    it('includes owner-scoped episodes in buildContextForOwner()', () => {
      const manager = new MemoryTierManager(db, silentLogger);
      manager.storeEpisode('observation', 'Owner A fact', 8, 'sess-A');
      episodicRepo.insert({ eventType: 'observation', content: 'Owner B fact', importance: 8, sessionId: 'sess-B', ownerId: 'owner-B' });
      const ctxB = manager.buildContextForOwner('owner-B');
      expect(ctxB.recentEpisodes.length).toBe(1);
      expect(ctxB.recentEpisodes[0]).toContain('Owner B fact');
    });
  });

  // ── 2. Recency-importance blended scoring ──────────────────────────

  describe('blended relevance scoring', () => {
    it('findTopByRelevance returns episodes ordered by blended score', () => {
      episodicRepo.insert({ eventType: 'recent_event', content: 'Just happened now', importance: 3 });
      const oldId = episodicRepo.insert({ eventType: 'old_event', content: 'Ancient history', importance: 9 });
      db.prepare('UPDATE episodic_memory SET created_at = datetime(\'now\', \'-30 days\') WHERE id = ?').run(oldId);
      const results = episodicRepo.findTopByRelevance(10);
      expect(results.length).toBe(2);
      expect(results[0]!.content).toBe('Ancient history'); // 18 > 11
    });

    it('recent episode beats stale one at similar importance', () => {
      episodicRepo.insert({ eventType: 'recent', content: 'Fresh insight', importance: 4 });
      const oldId = episodicRepo.insert({ eventType: 'old', content: 'Stale fact', importance: 6 });
      db.prepare('UPDATE episodic_memory SET created_at = datetime(\'now\', \'-30 days\') WHERE id = ?').run(oldId);
      const results = episodicRepo.findTopByRelevance(10);
      expect(results[0]!.content).toBe('Fresh insight'); // 13 > 12
    });

    it('findTopByRelevanceForOwner scopes to owner', () => {
      episodicRepo.insert({ eventType: 'obs', content: 'For owner A', importance: 5, ownerId: 'owner-A' });
      episodicRepo.insert({ eventType: 'obs', content: 'For owner B', importance: 5, ownerId: 'owner-B' });
      const results = episodicRepo.findTopByRelevanceForOwner('owner-A', 10);
      expect(results).toHaveLength(1);
      expect(results[0]!.content).toBe('For owner A');
    });
  });

  // ── 3. Consolidation dedup guard ───────────────────────────────────

  describe('consolidation idempotency (dedup)', () => {
    it('existsBySessionAndContent detects existing episodes', () => {
      episodicRepo.insert({
        eventType: 'consolidated_tool_result', content: 'Error: connection failed',
        sessionId: 'sess-1', importance: 5,
      });
      expect(episodicRepo.existsBySessionAndContent('sess-1', 'consolidated_tool_result', 'Error: connection failed')).toBe(true);
      expect(episodicRepo.existsBySessionAndContent('sess-1', 'consolidated_tool_result', 'Different content')).toBe(false);
      expect(episodicRepo.existsBySessionAndContent('sess-2', 'consolidated_tool_result', 'Error: connection failed')).toBe(false);
    });

    it('ConsolidationPipeline does not create duplicates on re-run', () => {
      const workingRepo = new WorkingMemoryRepository(db);
      const pipeline = new ConsolidationPipeline(db, silentLogger);
      const sid = 'dedup-test';
      workingRepo.insert({ sessionId: sid, type: 'tool_result', content: 'Error: critical failure in subsystem' });
      const r1 = pipeline.consolidateSession(sid, 'owner-1');
      expect(r1.episodesCreated).toBe(1);
      const r2 = pipeline.consolidateSession(sid, 'owner-1');
      expect(r2.episodesCreated).toBe(0);
      expect(episodicRepo.findByOwner('owner-1')).toHaveLength(1);
    });
  });

  // ── 4. Tier manager uses blended scoring ───────────────────────────

  describe('tier manager blended retrieval', () => {
    it('buildContext() uses blended scoring (recent episodes rank higher)', () => {
      const manager = new MemoryTierManager(db, silentLogger);
      manager.storeEpisode('insight', 'Fresh discovery', 4, 'sess-now');
      manager.storeEpisode('insight', 'Ancient wisdom', 6, 'sess-old');
      db.prepare('UPDATE episodic_memory SET created_at = datetime(\'now\', \'-30 days\') WHERE content = ?')
        .run('Ancient wisdom');
      const ctx = manager.buildContext();
      expect(ctx.recentEpisodes.length).toBe(2);
      expect(ctx.recentEpisodes[0]).toContain('Fresh discovery');
    });
  });

  // ── 5. Owner-local vs shared budget competition ───────────────────

  describe('owner-local budget reservation', () => {
    it('with ownerId, owner-scoped tiers get 60% of budget', () => {
      const manager = new MemoryTierManager(db, silentLogger, {
        maxContextTokens: 100, ownerId: 'owner-A', ownerBudgetRatio: 0.6,
      });
      manager.storeEpisode('observation', 'Owner A personal insight', 8, 'sess-A');
      manager.storeFact('pref', 'theme', 'dark mode preferred');
      const ctx = manager.buildContext();
      expect(ctx.recentEpisodes.length).toBeGreaterThanOrEqual(1);
      expect(ctx.relevantFacts.length).toBeGreaterThanOrEqual(1);
    });

    it('shared tier cannot consume owner-reserved budget', () => {
      const manager = new MemoryTierManager(db, silentLogger, {
        maxContextTokens: 40, ownerId: 'owner-X', ownerBudgetRatio: 0.6,
      });
      manager.storeFact('pref', 'big', 'A'.repeat(100)); // ~25 tokens
      manager.storeEpisode('note', 'Small memo', 5, 'sess-1');
      const ctx = manager.buildContext();
      expect(ctx.relevantFacts.length).toBe(0);
      expect(ctx.recentEpisodes.length).toBe(1);
    });

    it('without ownerId, all tiers share a unified budget', () => {
      const manager = new MemoryTierManager(db, silentLogger, { maxContextTokens: 200 });
      manager.storeEpisode('obs', 'Global episode', 5, 'sess-g');
      manager.storeFact('sys', 'version', '2.0');
      const ctx = manager.buildContext();
      expect(ctx.recentEpisodes.length).toBe(1);
      expect(ctx.relevantFacts.length).toBe(1);
    });
  });

  // ── 6. Summary / episodic soft dedup (15.1.1) ─────────────────────

  describe('summary/episodic soft dedup', () => {
    it('demotes overlapping episode with [echo] prefix instead of deleting', () => {
      const manager = new MemoryTierManager(db, silentLogger, { ownerId: 'owner-dedup' });
      manager.saveSessionSummary('sess-1', 'User discussed dark mode preferences and chose the midnight theme');
      episodicRepo.insert({
        eventType: 'consolidated_assistant',
        content: 'user discussed dark mode preferences and chose the midnight theme for the UI',
        importance: 7, ownerId: 'owner-dedup',
      });
      episodicRepo.insert({
        eventType: 'observation',
        content: 'Agent learned a new API endpoint for payment processing',
        importance: 6, ownerId: 'owner-dedup',
      });
      const ctx = manager.buildContext();
      expect(ctx.recentEpisodes.length).toBe(2);
      expect(ctx.recentEpisodes[0]).toContain('payment processing');
      expect(ctx.recentEpisodes[1]).toContain('[echo]');
      expect(ctx.recentEpisodes[1]).toContain('dark mode');
    });

    it('does NOT filter short episode content (<20 chars)', () => {
      const manager = new MemoryTierManager(db, silentLogger, { ownerId: 'owner-short' });
      manager.saveSessionSummary('sess-1', 'Short things');
      episodicRepo.insert({ eventType: 'note', content: 'Short things', importance: 5, ownerId: 'owner-short' });
      const ctx = manager.buildContext();
      expect(ctx.recentEpisodes.length).toBe(1);
    });
  });

  // ── 7. Explainability contracts ───────────────────────────────────

  describe('explainability contracts', () => {
    it('blended score formula: importance×2 + recency_bonus', () => {
      episodicRepo.insert({ eventType: 'a', content: 'High recent', importance: 10 });
      const midId = episodicRepo.insert({ eventType: 'b', content: 'Mid stale', importance: 5 });
      db.prepare('UPDATE episodic_memory SET created_at = datetime(\'now\', \'-2 days\') WHERE id = ?').run(midId);
      const oldId = episodicRepo.insert({ eventType: 'c', content: 'High ancient', importance: 8 });
      db.prepare('UPDATE episodic_memory SET created_at = datetime(\'now\', \'-30 days\') WHERE id = ?').run(oldId);
      const results = episodicRepo.findTopByRelevance(10);
      expect(results[0]!.content).toBe('High recent');
      expect(results[1]!.content).toBe('High ancient');
      expect(results[2]!.content).toBe('Mid stale');
    });

    it('recency tiers: <1h=5, <1d=3, <7d=1, else=0', () => {
      episodicRepo.insert({ eventType: 'x', content: 'Just now', importance: 1 });
      const h12 = episodicRepo.insert({ eventType: 'x', content: '12 hours ago', importance: 1 });
      db.prepare('UPDATE episodic_memory SET created_at = datetime(\'now\', \'-12 hours\') WHERE id = ?').run(h12);
      const d3 = episodicRepo.insert({ eventType: 'x', content: '3 days ago', importance: 1 });
      db.prepare('UPDATE episodic_memory SET created_at = datetime(\'now\', \'-3 days\') WHERE id = ?').run(d3);
      const d30 = episodicRepo.insert({ eventType: 'x', content: '30 days ago', importance: 1 });
      db.prepare('UPDATE episodic_memory SET created_at = datetime(\'now\', \'-30 days\') WHERE id = ?').run(d30);
      const results = episodicRepo.findTopByRelevance(10);
      expect(results.map(r => r.content)).toEqual([
        'Just now', '12 hours ago', '3 days ago', '30 days ago',
      ]);
    });
  });

  // ── 8. Budget fairness ────────────────────────────────────────────

  describe('budget fairness', () => {
    it('shared knowledge is not completely starved when owner has few entries', () => {
      const manager = new MemoryTierManager(db, silentLogger, {
        maxContextTokens: 500, ownerId: 'sparse-owner', ownerBudgetRatio: 0.6,
      });
      manager.storeEpisode('note', 'One small note', 5, 'sess-1');
      manager.storeFact('sys', 'v1', 'System version 1.0');
      manager.storeFact('sys', 'v2', 'API endpoint catalog');
      manager.storeFact('sys', 'v3', 'Error handling docs');
      const ctx = manager.buildContext();
      expect(ctx.recentEpisodes.length).toBe(1);
      expect(ctx.relevantFacts.length).toBe(3);
    });
  });
});

// ── Round 15.1.1 Hardening Tests ────────────────────────────────────────

describe('Memory Intelligence Hardening (Round 15.1.1)', () => {
  let db: Database.Database;
  let episodicRepo: EpisodicMemoryRepository;

  beforeEach(() => {
    db = freshDb();
    episodicRepo = new EpisodicMemoryRepository(db);
  });

  // ── 9. Dynamic budget reflow ──────────────────────────────────────

  describe('dynamic budget reflow', () => {
    it('owner leftover budget flows to shared items that were skipped', () => {
      const manager = new MemoryTierManager(db, silentLogger, {
        maxContextTokens: 200, ownerId: 'owner-reflow', ownerBudgetRatio: 0.6,
      });
      // Tiny owner episode — uses ~10 tokens, leaving ~110 leftover
      manager.storeEpisode('note', 'Short memo', 5, 'sess-1');
      // Multiple shared facts, each ~15 tokens
      for (let i = 0; i < 8; i++) {
        manager.storeFact('sys', `key-${i}`, `Value for key number ${i} with decent length`);
      }
      const ctx = manager.buildContext();
      // With reflow: owner leftover should help fit more shared facts than raw 40% allows
      expect(ctx.relevantFacts.length).toBeGreaterThan(5);
    });

    it('shared leftover budget absorbs demoted episodes', () => {
      const manager = new MemoryTierManager(db, silentLogger, {
        maxContextTokens: 500, ownerId: 'owner-reflow2', ownerBudgetRatio: 0.6,
      });
      manager.saveSessionSummary('sess-1', 'Discussed API versioning strategy for the new microservice architecture');
      episodicRepo.insert({
        eventType: 'consolidated_assistant',
        content: 'Discussed API versioning strategy for the new microservice architecture and deployment',
        importance: 7, ownerId: 'owner-reflow2',
      });
      episodicRepo.insert({
        eventType: 'observation',
        content: 'Database migration completed successfully',
        importance: 5, ownerId: 'owner-reflow2',
      });
      const ctx = manager.buildContext();
      const echoEpisodes = ctx.recentEpisodes.filter(e => e.includes('[echo]'));
      expect(echoEpisodes.length).toBe(1);
    });
  });

  // ── 10. Continuity scoring bonus ──────────────────────────────────

  describe('continuity scoring', () => {
    it('preference/lesson episodes rank higher than raw observations at same importance and age', () => {
      episodicRepo.insert({ eventType: 'preference_theme', content: 'Prefers dark mode', importance: 5 });
      episodicRepo.insert({ eventType: 'consolidated_tool_result', content: 'API call succeeded', importance: 5 });
      episodicRepo.insert({ eventType: 'observation', content: 'Regular note', importance: 5 });
      const results = episodicRepo.findTopByRelevance(10);
      expect(results[0]!.content).toBe('Prefers dark mode');     // 18 (pref +3)
      expect(results[1]!.content).toBe('API call succeeded');    // 17 (consolidated +2)
      expect(results[2]!.content).toBe('Regular note');          // 15 (no bonus)
    });

    it('continuity bonus helps old but durable episodes compete with fresh trivial ones', () => {
      const prefId = episodicRepo.insert({ eventType: 'preference_ui', content: 'Prefers compact layout', importance: 5 });
      db.prepare('UPDATE episodic_memory SET created_at = datetime(\'now\', \'-30 days\') WHERE id = ?').run(prefId);
      episodicRepo.insert({ eventType: 'observation', content: 'Opened settings page', importance: 3 });
      const results = episodicRepo.findTopByRelevance(10);
      // Old preference (5*2+0+3=13) beats fresh trivial (3*2+5+0=11)
      expect(results[0]!.content).toBe('Prefers compact layout');
    });
  });

  // ── 11. Categorized episode rendering ─────────────────────────────

  describe('categorized episode rendering', () => {
    it('preserves event_type tags for categorization in system prompt', () => {
      const manager = new MemoryTierManager(db, silentLogger);
      manager.storeEpisode('error_report', 'Connection timeout on API v2', 7, 'sess-1');
      manager.storeEpisode('preference_theme', 'User chose dark mode', 6, 'sess-1');
      manager.storeEpisode('observation', 'New user session started', 4, 'sess-1');
      const ctx = manager.buildContext();
      expect(ctx.recentEpisodes.length).toBe(3);
      expect(ctx.recentEpisodes.some(e => e.includes('error_report'))).toBe(true);
      expect(ctx.recentEpisodes.some(e => e.includes('preference_theme'))).toBe(true);
      expect(ctx.recentEpisodes.some(e => e.includes('observation'))).toBe(true);
    });
  });
});
