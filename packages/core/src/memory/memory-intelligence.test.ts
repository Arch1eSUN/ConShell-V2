/**
 * memory-intelligence.test.ts — Round 15.1 / 15.1.1 / 15.1.2 Quality Tests
 *
 * Round 15.1: episodes in prompt, blended scoring, consolidation dedup
 * Round 15.1.1: dynamic budget reflow, soft dedup, continuity scoring, categorized rendering
 * Round 15.1.2: quality closure — unified scoring, echo cap, stability bonus, event_type rendering
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
      expect(results[0]!.content).toBe('Ancient history');
    });

    it('recent episode beats stale one at similar importance', () => {
      episodicRepo.insert({ eventType: 'recent', content: 'Fresh insight', importance: 4 });
      const oldId = episodicRepo.insert({ eventType: 'old', content: 'Stale fact', importance: 6 });
      db.prepare('UPDATE episodic_memory SET created_at = datetime(\'now\', \'-30 days\') WHERE id = ?').run(oldId);
      const results = episodicRepo.findTopByRelevance(10);
      expect(results[0]!.content).toBe('Fresh insight');
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
      manager.storeFact('pref', 'big', 'A'.repeat(100));
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

  // ── 6. Summary / episodic soft dedup (15.1.2 — echoContext) ───────

  describe('summary/episodic soft dedup', () => {
    it('demoted episodes go to echoContext, not recentEpisodes', () => {
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
      expect(ctx.recentEpisodes.some(e => e.includes('payment processing'))).toBe(true);
      expect(ctx.echoContext.some(e => e.includes('[echo]') && e.includes('dark mode'))).toBe(true);
      expect(ctx.recentEpisodes.every(e => !e.includes('[echo]'))).toBe(true);
    });

    it('does NOT filter short episode content (<15 chars)', () => {
      const manager = new MemoryTierManager(db, silentLogger, { ownerId: 'owner-short' });
      manager.saveSessionSummary('sess-1', 'Short things');
      episodicRepo.insert({ eventType: 'note', content: 'Short things', importance: 5, ownerId: 'owner-short' });
      const ctx = manager.buildContext();
      expect(ctx.recentEpisodes.length).toBe(1);
    });
  });

  // ── 7. Explainability contracts ───────────────────────────────────

  describe('explainability contracts', () => {
    it('blended score formula: importance*2 + recency_bonus + stability_bonus', () => {
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

    it('recency tiers: <1h=5, <1d=3, <7d=1, else=floor', () => {
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

// ── Round 15.1.2 Quality Closure Tests ──────────────────────────────────

describe('Memory Intelligence Quality Closure (Round 15.1.2)', () => {
  let db: Database.Database;
  let episodicRepo: EpisodicMemoryRepository;

  beforeEach(() => {
    db = freshDb();
    episodicRepo = new EpisodicMemoryRepository(db);
  });

  // ── 9. Budget: summaries don't monopolize owner bucket ────────────

  describe('unified owner budget competition', () => {
    it('high-score episode beats low-priority summary in owner bucket', () => {
      const manager = new MemoryTierManager(db, silentLogger, {
        maxContextTokens: 60, ownerId: 'owner-compete', ownerBudgetRatio: 0.6,
      });
      manager.saveSessionSummary('sess-1', 'Session summary about general topics');
      episodicRepo.insert({
        eventType: 'lesson_critical', content: 'Critical lesson learned', importance: 8, ownerId: 'owner-compete',
      });
      const ctx = manager.buildContext();
      expect(ctx.recentEpisodes.length + ctx.sessionSummaries.length).toBeGreaterThanOrEqual(1);
      expect(ctx.recentEpisodes.some(e => e.includes('Critical lesson'))).toBe(true);
    });

    it('buildContextForOwner also uses unified scoring', () => {
      const manager = new MemoryTierManager(db, silentLogger, {
        maxContextTokens: 60, ownerId: 'owner-for', ownerBudgetRatio: 0.6,
      });
      manager.saveSessionSummary('sess-1', 'General conversation about weather');
      episodicRepo.insert({
        eventType: 'observation', content: 'Important finding', importance: 9, ownerId: 'owner-for',
      });
      const ctx = manager.buildContextForOwner('owner-for');
      expect(ctx.recentEpisodes.some(e => e.includes('Important finding'))).toBe(true);
    });
  });

  // ── 10. Echo cap: max 2 echoes in echoContext ─────────────────────

  describe('echo cap enforcement', () => {
    it('caps echo at 2 items even with more overlapping episodes', () => {
      const manager = new MemoryTierManager(db, silentLogger, {
        maxContextTokens: 1000, ownerId: 'owner-echocap', ownerBudgetRatio: 0.6,
      });
      const summaryContent = 'The team discussed migration strategy including database schema changes and API versioning';
      manager.saveSessionSummary('sess-1', summaryContent);
      for (let i = 0; i < 4; i++) {
        episodicRepo.insert({
          eventType: 'consolidated_assistant',
          content: `the team discussed migration strategy including database schema changes and api versioning round ${i}`,
          importance: 5, ownerId: 'owner-echocap',
        });
      }
      const ctx = manager.buildContext();
      expect(ctx.echoContext.length).toBeLessThanOrEqual(2);
      expect(ctx.recentEpisodes.every(e => !e.includes('[echo]'))).toBe(true);
    });

    it('echo items never appear in recentEpisodes', () => {
      const manager = new MemoryTierManager(db, silentLogger, { ownerId: 'owner-noleak' });
      manager.saveSessionSummary('sess-1', 'Discussed the quarterly planning meeting and budget allocation process');
      episodicRepo.insert({
        eventType: 'observation',
        content: 'discussed the quarterly planning meeting and budget allocation process in detail',
        importance: 6, ownerId: 'owner-noleak',
      });
      const ctx = manager.buildContext();
      expect(ctx.recentEpisodes.every(e => !e.includes('[echo]'))).toBe(true);
      expect(ctx.echoContext.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 11. Stability bonus replaces category bonus ───────────────────

  describe('stability bonus scoring', () => {
    it('importance>=7 gets stability+2 regardless of event_type', () => {
      episodicRepo.insert({ eventType: 'observation', content: 'Critical system observation', importance: 7 });
      episodicRepo.insert({ eventType: 'preference_theme', content: 'Theme preference', importance: 4 });
      const results = episodicRepo.findTopByRelevance(10);
      expect(results[0]!.content).toBe('Critical system observation');
    });

    it('importance>=5 gets stability+1', () => {
      episodicRepo.insert({ eventType: 'observation', content: 'Mid importance note', importance: 5 });
      episodicRepo.insert({ eventType: 'observation', content: 'Low importance note', importance: 4 });
      const results = episodicRepo.findTopByRelevance(10);
      expect(results[0]!.content).toBe('Mid importance note');
    });

    it('importance>=7 old episode keeps recency floor (+1 instead of 0)', () => {
      const oldHighId = episodicRepo.insert({ eventType: 'lesson_core', content: 'Core lesson', importance: 7 });
      db.prepare('UPDATE episodic_memory SET created_at = datetime(\'now\', \'-30 days\') WHERE id = ?').run(oldHighId);
      const oldLowId = episodicRepo.insert({ eventType: 'observation', content: 'Old trivial note', importance: 4 });
      db.prepare('UPDATE episodic_memory SET created_at = datetime(\'now\', \'-30 days\') WHERE id = ?').run(oldLowId);
      const results = episodicRepo.findTopByRelevance(10);
      expect(results[0]!.content).toBe('Core lesson');
      expect(results[1]!.content).toBe('Old trivial note');
    });
  });

  // ── 12. event_type-based rendering (no regex content match) ───────

  describe('event_type categorized rendering', () => {
    it('categories based on event_type tag, not content words', () => {
      const manager = new MemoryTierManager(db, silentLogger);
      manager.storeEpisode('observation', 'The error rate dropped significantly', 5, 'sess-1');
      manager.storeEpisode('lesson_core', 'Always validate input before processing', 7, 'sess-1');
      manager.storeEpisode('preference_ui', 'User prefers compact layout', 6, 'sess-1');
      const ctx = manager.buildContext();
      const observationItems = ctx.recentEpisodes.filter(e => e.startsWith('[observation]'));
      const lessonItems = ctx.recentEpisodes.filter(e => e.startsWith('[lesson'));
      expect(observationItems.length).toBe(1);
      expect(observationItems[0]).toContain('error rate dropped');
      expect(lessonItems.length).toBe(1);
      expect(lessonItems[0]).toContain('validate input');
    });

    it('echoContext renders in separate block', () => {
      const manager = new MemoryTierManager(db, silentLogger, { ownerId: 'owner-render' });
      manager.saveSessionSummary('sess-1', 'Discussed performance optimization strategies for the database layer');
      episodicRepo.insert({
        eventType: 'consolidated_assistant',
        content: 'discussed performance optimization strategies for the database layer and caching',
        importance: 5, ownerId: 'owner-render',
      });
      const ctx = manager.buildContext();
      expect(ctx.echoContext.length).toBeGreaterThanOrEqual(1);
      expect(ctx.echoContext[0]).toContain('[echo]');
    });
  });

  // ── 13. Dynamic budget reflow still works ─────────────────────────

  describe('dynamic budget reflow', () => {
    it('owner leftover budget flows to shared items', () => {
      const manager = new MemoryTierManager(db, silentLogger, {
        maxContextTokens: 200, ownerId: 'owner-reflow', ownerBudgetRatio: 0.6,
      });
      manager.storeEpisode('note', 'Short memo', 5, 'sess-1');
      for (let i = 0; i < 8; i++) {
        manager.storeFact('sys', `key-${i}`, `Value for key number ${i} with decent length`);
      }
      const ctx = manager.buildContext();
      expect(ctx.relevantFacts.length).toBeGreaterThan(5);
    });

    it('shared leftover absorbs echo items (in echoContext)', () => {
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
      expect(ctx.echoContext.some(e => e.includes('[echo]'))).toBe(true);
      expect(ctx.recentEpisodes.every(e => !e.includes('[echo]'))).toBe(true);
    });
  });
});
