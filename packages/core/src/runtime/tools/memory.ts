/**
 * 内置工具: 记忆系统操作
 * 连接 MemoryTierManager，提供 Agent 可调用的记忆读写能力
 */
import type { ToolHandler } from '../tool-executor.js';
import type { MemoryTierManager } from '../../memory/tier-manager.js';

// ── Factory ───────────────────────────────────────────────────────────

/**
 * Create memory tools bound to a specific MemoryTierManager instance.
 * Must be called after Kernel boots the memory subsystem.
 */
export function createMemoryTools(memory: MemoryTierManager): ToolHandler[] {
  const memoryStoreTool: ToolHandler = {
    name: 'memory_store',
    description:
      'Store a fact, episode, or relationship into long-term memory. ' +
      'Args: { type: "fact"|"episode"|"relationship", category?: string, key?: string, value: string, importance?: number }',
    async execute(args) {
      const type = String(args['type'] ?? 'fact');
      const value = String(args['value'] ?? '');
      if (!value) return 'Error: value is required';

      try {
        switch (type) {
          case 'fact': {
            const category = String(args['category'] ?? 'general');
            const key = String(args['key'] ?? `fact_${Date.now()}`);
            memory.storeFact(category, key, value);
            return `Stored fact: [${category}/${key}] ${value.slice(0, 100)}`;
          }
          case 'episode': {
            const eventType = String(args['event_type'] ?? 'observation');
            const importance = Number(args['importance'] ?? 5);
            const sessionId = args['session_id'] ? String(args['session_id']) : undefined;
            memory.storeEpisode(eventType, value, importance, sessionId);
            return `Stored episode: [${eventType}] ${value.slice(0, 100)} (importance: ${importance})`;
          }
          case 'relationship': {
            const entityId = String(args['entity_id'] ?? '');
            const entityType = String(args['entity_type'] ?? 'unknown');
            if (!entityId) return 'Error: entity_id is required for relationship type';
            const trustDelta = args['trust_delta'] !== undefined ? Number(args['trust_delta']) : undefined;
            memory.storeRelationship(entityId, entityType, trustDelta, value);
            return `Stored relationship: ${entityId} (${entityType})`;
          }
          default:
            return `Error: Unknown memory type "${type}". Use "fact", "episode", or "relationship".`;
        }
      } catch (err) {
        return `Error storing memory: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  };

  const memoryRecallTool: ToolHandler = {
    name: 'memory_recall',
    description:
      'Recall information from long-term memory. Returns relevant facts, episodes, and relationships. ' +
      'Args: { query?: string, type?: "all"|"facts"|"episodes"|"relationships"|"context" }',
    async execute(args) {
      const type = String(args['type'] ?? 'context');

      try {
        if (type === 'context' || type === 'all') {
          const ctx = memory.buildContext();
          const parts: string[] = [];

          if (ctx.sessionSummaries.length > 0) {
            parts.push(`## Session Summaries\n${ctx.sessionSummaries.join('\n')}`);
          }
          if (ctx.relevantFacts.length > 0) {
            parts.push(`## Known Facts\n${ctx.relevantFacts.join('\n')}`);
          }
          if (ctx.relationships.length > 0) {
            parts.push(`## Relationships\n${ctx.relationships.join('\n')}`);
          }
          if (ctx.recentEpisodes.length > 0) {
            parts.push(`## Recent Episodes\n${ctx.recentEpisodes.join('\n')}`);
          }
          if (ctx.skills.length > 0) {
            parts.push(`## Skills\n${ctx.skills.join('\n')}`);
          }

          if (parts.length === 0) return 'No memories stored yet.';
          return `Memory Context (~${ctx.estimatedTokens} tokens):\n\n${parts.join('\n\n')}`;
        }

        if (type === 'facts') {
          const ctx = memory.buildContext();
          if (ctx.relevantFacts.length === 0) return 'No facts stored yet.';
          return `Known Facts:\n${ctx.relevantFacts.join('\n')}`;
        }

        if (type === 'episodes') {
          const ctx = memory.buildContext();
          if (ctx.recentEpisodes.length === 0) return 'No episodes stored yet.';
          return `Recent Episodes:\n${ctx.recentEpisodes.join('\n')}`;
        }

        if (type === 'relationships') {
          const ctx = memory.buildContext();
          if (ctx.relationships.length === 0) return 'No relationships stored yet.';
          return `Relationships:\n${ctx.relationships.join('\n')}`;
        }

        return `Error: Unknown recall type "${type}". Use "context", "facts", "episodes", or "relationships".`;
      } catch (err) {
        return `Error recalling memories: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  };

  return [memoryStoreTool, memoryRecallTool];
}
