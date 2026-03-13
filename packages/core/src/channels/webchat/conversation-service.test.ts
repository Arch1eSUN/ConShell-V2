/**
 * ConversationService tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { openTestDatabase } from '../../state/database.js';
import { SessionsRepository } from '../../state/repos/sessions.js';
import { TurnsRepository } from '../../state/repos/turns.js';
import { ConversationService } from './conversation-service.js';

const silentLogger = {
  debug: () => {}, info: () => {}, warn: () => {}, error: () => {},
  child: function () { return this; },
};

describe('ConversationService', () => {
  let db: ReturnType<typeof openTestDatabase>;
  let sessions: SessionsRepository;
  let turns: TurnsRepository;
  let service: ConversationService;

  beforeEach(() => {
    db = openTestDatabase(silentLogger as any);
    sessions = new SessionsRepository(db);
    turns = new TurnsRepository(db);
    service = new ConversationService(sessions, turns);
  });

  describe('appendTurn', () => {
    it('auto-creates session on first turn', () => {
      service.appendTurn({
        sessionId: 'sess-1',
        role: 'user',
        content: 'Hello!',
      });

      const session = sessions.findById('sess-1');
      expect(session).toBeDefined();
      expect(session!.channel).toBe('webchat');
    });

    it('persists turn content', () => {
      service.appendTurn({ sessionId: 'sess-1', role: 'user', content: 'Hello' });
      service.appendTurn({ sessionId: 'sess-1', role: 'assistant', content: 'World' });

      const allTurns = turns.findBySession('sess-1');
      expect(allTurns.length).toBe(2);
      expect(allTurns[0]!.role).toBe('user');
      expect(allTurns[0]!.content).toBe('Hello');
      expect(allTurns[1]!.role).toBe('assistant');
      expect(allTurns[1]!.content).toBe('World');
    });

    it('auto-generates title from first user message', () => {
      service.appendTurn({
        sessionId: 'sess-1',
        role: 'user',
        content: 'What is the meaning of life?',
      });

      const session = sessions.findById('sess-1');
      expect(session!.title).toBe('What is the meaning of life?');
    });

    it('truncates long title to 50 chars', () => {
      const longMsg = 'A'.repeat(80);
      service.appendTurn({
        sessionId: 'sess-1',
        role: 'user',
        content: longMsg,
      });

      const session = sessions.findById('sess-1');
      expect(session!.title!.length).toBe(51); // 50 + '…'
      expect(session!.title!.endsWith('…')).toBe(true);
    });

    it('does not overwrite existing title', () => {
      service.appendTurn({ sessionId: 'sess-1', role: 'user', content: 'First message' });
      service.appendTurn({ sessionId: 'sess-1', role: 'user', content: 'Second message' });

      const session = sessions.findById('sess-1');
      expect(session!.title).toBe('First message');
    });
  });

  describe('buildContext', () => {
    it('returns messages in order', () => {
      service.appendTurn({ sessionId: 's1', role: 'user', content: 'A' });
      service.appendTurn({ sessionId: 's1', role: 'assistant', content: 'B' });
      service.appendTurn({ sessionId: 's1', role: 'user', content: 'C' });

      const ctx = service.buildContext('s1');
      expect(ctx.length).toBe(3);
      expect(ctx[0]!.role).toBe('user');
      expect(ctx[0]!.content).toBe('A');
      expect(ctx[2]!.role).toBe('user');
      expect(ctx[2]!.content).toBe('C');
    });

    it('prepends system prompt when provided', () => {
      service.appendTurn({ sessionId: 's1', role: 'user', content: 'hi' });

      const ctx = service.buildContext('s1', { systemPrompt: 'You are a turtle.' });
      expect(ctx.length).toBe(2);
      expect(ctx[0]!.role).toBe('system');
      expect(ctx[0]!.content).toBe('You are a turtle.');
    });

    it('truncates to maxTurns (most recent)', () => {
      for (let i = 0; i < 10; i++) {
        service.appendTurn({ sessionId: 's1', role: 'user', content: `msg-${i}` });
      }

      const ctx = service.buildContext('s1', { maxTurns: 3 });
      expect(ctx.length).toBe(3);
      expect(ctx[0]!.content).toBe('msg-7');
      expect(ctx[2]!.content).toBe('msg-9');
    });

    it('returns empty array for non-existent session', () => {
      const ctx = service.buildContext('nonexistent');
      expect(ctx.length).toBe(0);
    });
  });

  describe('getTranscript', () => {
    it('returns all turns for a session', () => {
      service.appendTurn({ sessionId: 's1', role: 'user', content: 'a' });
      service.appendTurn({ sessionId: 's1', role: 'assistant', content: 'b' });

      const transcript = service.getTranscript('s1');
      expect(transcript.length).toBe(2);
    });

    it('returns empty array for empty session', () => {
      expect(service.getTranscript('empty')).toEqual([]);
    });
  });

  describe('session management', () => {
    it('listSessions returns sessions with counts', () => {
      service.appendTurn({ sessionId: 's1', role: 'user', content: 'a' });
      service.appendTurn({ sessionId: 's1', role: 'assistant', content: 'b' });
      service.appendTurn({ sessionId: 's2', role: 'user', content: 'c' });

      const list = service.listSessions();
      expect(list.length).toBe(2);
      // s2 should be first (most recent)
      const s1 = list.find(s => s.id === 's1');
      const s2 = list.find(s => s.id === 's2');
      expect(s1!.message_count).toBe(2);
      expect(s2!.message_count).toBe(1);
    });

    it('getSession returns session details', () => {
      service.appendTurn({ sessionId: 's1', role: 'user', content: 'test' });
      const session = service.getSession('s1');
      expect(session).toBeDefined();
      expect(session!.id).toBe('s1');
    });

    it('updateTitle changes the title', () => {
      service.appendTurn({ sessionId: 's1', role: 'user', content: 'original' });
      service.updateTitle('s1', 'New Title');
      expect(service.getSession('s1')!.title).toBe('New Title');
    });

    it('deleteSession removes session and turns', () => {
      service.appendTurn({ sessionId: 's1', role: 'user', content: 'to delete' });
      service.appendTurn({ sessionId: 's1', role: 'assistant', content: 'reply' });

      const ok = service.deleteSession('s1');
      expect(ok).toBe(true);
      expect(service.getSession('s1')).toBeUndefined();
      expect(service.getTranscript('s1').length).toBe(0);
    });

    it('sessionCount returns total count', () => {
      expect(service.sessionCount()).toBe(0);
      service.appendTurn({ sessionId: 's1', role: 'user', content: 'a' });
      service.appendTurn({ sessionId: 's2', role: 'user', content: 'b' });
      expect(service.sessionCount()).toBe(2);
    });
  });
});
