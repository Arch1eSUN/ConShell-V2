/**
 * Memory Tools 单元测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMemoryTools } from './memory.js';
import type { ToolHandler } from '../tool-executor.js';
import type { MemoryTierManager, MemoryContext } from '../../memory/tier-manager.js';

// ── Mock MemoryTierManager ────────────────────────────────────────────

function createMockMemory(): MemoryTierManager {
  const storedFacts: Array<{ category: string; key: string; value: string }> = [];
  const storedEpisodes: Array<{ eventType: string; content: string; importance?: number }> = [];
  const storedRelationships: Array<{ entityId: string; entityType: string }> = [];

  return {
    storeFact(category: string, key: string, value: string) {
      storedFacts.push({ category, key, value });
    },
    storeEpisode(eventType: string, content: string, importance?: number) {
      storedEpisodes.push({ eventType, content, importance });
    },
    storeRelationship(entityId: string, entityType: string, _trustDelta?: number, _notes?: string) {
      storedRelationships.push({ entityId, entityType });
    },
    buildContext(): MemoryContext {
      return {
        sessionSummaries: ['Summary of session 1'],
        relevantFacts: storedFacts.map(f => `[${f.category}/${f.key}] ${f.value}`),
        relationships: storedRelationships.map(r => `${r.entityId} (${r.entityType}) trust:50 interactions:0`),
        recentEpisodes: storedEpisodes.map(e => `[${e.eventType}] ${e.content}`),
        skills: ['Skill "web_browse": success=3 fail=0'],
        estimatedTokens: 100,
      };
    },
  } as unknown as MemoryTierManager;
}

describe('Memory Tools', () => {
  let tools: ToolHandler[];
  let storeTool: ToolHandler;
  let recallTool: ToolHandler;
  let mockMemory: MemoryTierManager;

  beforeEach(() => {
    mockMemory = createMockMemory();
    tools = createMemoryTools(mockMemory);
    storeTool = tools.find(t => t.name === 'memory_store')!;
    recallTool = tools.find(t => t.name === 'memory_recall')!;
  });

  // ── memory_store tests ──────────────────────────────────────────────

  describe('memory_store', () => {
    it('should exist with correct name', () => {
      expect(storeTool).toBeDefined();
      expect(storeTool.name).toBe('memory_store');
    });

    it('should store a fact', async () => {
      const result = await storeTool.execute({
        type: 'fact',
        category: 'user_prefs',
        key: 'language',
        value: 'English',
      });
      expect(result).toContain('Stored fact');
      expect(result).toContain('user_prefs/language');
    });

    it('should store an episode', async () => {
      const result = await storeTool.execute({
        type: 'episode',
        event_type: 'task_completed',
        value: 'Finished the report',
        importance: 8,
      });
      expect(result).toContain('Stored episode');
      expect(result).toContain('task_completed');
    });

    it('should store a relationship', async () => {
      const result = await storeTool.execute({
        type: 'relationship',
        entity_id: 'user_alice',
        entity_type: 'human',
        value: 'Friendly and helpful',
      });
      expect(result).toContain('Stored relationship');
      expect(result).toContain('user_alice');
    });

    it('should reject empty value', async () => {
      const result = await storeTool.execute({ type: 'fact' });
      expect(result).toContain('Error: value is required');
    });

    it('should reject missing entity_id for relationship', async () => {
      const result = await storeTool.execute({
        type: 'relationship',
        value: 'Some notes',
      });
      expect(result).toContain('Error: entity_id is required');
    });

    it('should reject unknown type', async () => {
      const result = await storeTool.execute({ type: 'invalid', value: 'test' });
      expect(result).toContain('Unknown memory type');
    });
  });

  // ── memory_recall tests ─────────────────────────────────────────────

  describe('memory_recall', () => {
    it('should exist with correct name', () => {
      expect(recallTool).toBeDefined();
      expect(recallTool.name).toBe('memory_recall');
    });

    it('should recall full context', async () => {
      // First store something
      await storeTool.execute({ type: 'fact', category: 'test', key: 'k1', value: 'v1' });

      const result = await recallTool.execute({ type: 'context' });
      expect(result).toContain('Memory Context');
      expect(result).toContain('Session Summaries');
      expect(result).toContain('Known Facts');
    });

    it('should recall facts only', async () => {
      await storeTool.execute({ type: 'fact', category: 'test', key: 'k1', value: 'v1' });
      const result = await recallTool.execute({ type: 'facts' });
      expect(result).toContain('Known Facts');
    });

    it('should recall episodes only', async () => {
      await storeTool.execute({ type: 'episode', value: 'Something happened' });
      const result = await recallTool.execute({ type: 'episodes' });
      expect(result).toContain('Recent Episodes');
    });

    it('should reject unknown recall type', async () => {
      const result = await recallTool.execute({ type: 'invalid' });
      expect(result).toContain('Unknown recall type');
    });
  });
});
