/**
 * ChatPage — Session-aware 对话界面
 *
 * 左侧面板: 会话列表（从 API 拉取）
 * 右侧面板: 对话区域
 * 支持: 新建会话、切换会话、加载 transcript、删除会话
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api, type SessionItem, type TurnItem } from '../api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  cost?: number;
}

const SESSION_KEY = 'conshell_session_id';

function generateSessionId(): string {
  return crypto.randomUUID();
}

export function ChatPage() {
  // ── Session State ──────────────────────────────────────
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    return localStorage.getItem(SESSION_KEY) || generateSessionId();
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  // ── Effects ────────────────────────────────────────────

  // Persist session ID
  useEffect(() => {
    localStorage.setItem(SESSION_KEY, currentSessionId);
  }, [currentSessionId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load sessions on mount
  const loadSessions = useCallback(async () => {
    try {
      const data = await api.listSessions(50, 0);
      setSessions(data.sessions);
    } catch {
      // Silently fail — server may not be running
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Load transcript when switching sessions
  const loadTranscript = useCallback(async (sessionId: string) => {
    try {
      const data = await api.getTranscript(sessionId);
      setMessages(
        data.turns.map((t: TurnItem) => ({
          role: t.role,
          content: t.content ?? '',
          timestamp: new Date(t.created_at).getTime(),
          cost: t.cost_cents > 0 ? t.cost_cents : undefined,
        })),
      );
    } catch {
      // New session or server unavailable — start fresh
      setMessages([]);
    }
  }, []);

  useEffect(() => { loadTranscript(currentSessionId); }, [currentSessionId, loadTranscript]);

  // ── Actions ────────────────────────────────────────────

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: Date.now() }]);
    setStreaming(true);

    let fullResponse = '';
    try {
      for await (const chunk of api.chatStream(text, currentSessionId)) {
        fullResponse += chunk;
        setMessages(prev => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === 'assistant') {
            copy[copy.length - 1] = { ...last, content: fullResponse };
          } else {
            copy.push({ role: 'assistant', content: fullResponse, timestamp: Date.now() });
          }
          return copy;
        });
      }
    } catch (err) {
      fullResponse = `Error: ${err instanceof Error ? err.message : String(err)}`;
      setMessages(prev => [...prev, { role: 'assistant', content: fullResponse, timestamp: Date.now() }]);
    }
    setStreaming(false);
    // Refresh sessions list
    loadSessions();
  };

  const newSession = () => {
    const id = generateSessionId();
    setCurrentSessionId(id);
    setMessages([]);
  };

  const switchSession = (id: string) => {
    if (id === currentSessionId) return;
    setCurrentSessionId(id);
  };

  const deleteSession = async (id: string) => {
    try {
      await api.deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (id === currentSessionId) {
        newSession();
      }
    } catch {
      // ignore
    }
  };

  // ── Render ─────────────────────────────────────────────

  return (
    <div style={s.container}>
      {/* Sidebar */}
      {sidebarOpen && (
        <div style={s.sidebar}>
          <div style={s.sidebarHeader}>
            <span style={s.sidebarTitle}>Sessions</span>
            <button style={s.newBtn} onClick={newSession} title="New conversation">+</button>
          </div>
          <div style={s.sessionList}>
            {sessions.map(session => (
              <div
                key={session.id}
                style={{
                  ...s.sessionItem,
                  ...(session.id === currentSessionId ? s.sessionActive : {}),
                }}
                onClick={() => switchSession(session.id)}
              >
                <div style={s.sessionTitle}>
                  {session.title || 'Untitled'}
                </div>
                <div style={s.sessionMeta}>
                  {session.message_count} msgs · {new Date(session.updated_at).toLocaleDateString()}
                </div>
                <button
                  style={s.deleteBtn}
                  onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                  title="Delete"
                >×</button>
              </div>
            ))}
            {sessions.length === 0 && (
              <div style={s.emptyList}>No sessions yet</div>
            )}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div style={s.main}>
        {/* Toggle sidebar */}
        <button
          style={s.toggleBtn}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>

        <h1 style={s.title}>Chat</h1>

        <div style={s.messagesContainer}>
          {messages.length === 0 && (
            <div style={s.empty}>
              <div style={s.emptyIcon}>🐢</div>
              <p>Start a conversation with your agent</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ ...s.message, ...(msg.role === 'user' ? s.userMsg : s.assistantMsg) }}>
              <div style={s.msgRole}>{msg.role === 'user' ? 'You' : '🐢 Agent'}</div>
              <div style={s.msgContent}>{msg.content}</div>
            </div>
          ))}
          {streaming && <div style={s.typing}>Agent is thinking…</div>}
          <div ref={endRef} />
        </div>

        <div style={s.inputRow}>
          <input
            style={s.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message…"
            disabled={streaming}
          />
          <button style={s.sendBtn} onClick={sendMessage} disabled={streaming || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: 'calc(100vh - 64px)',
    overflow: 'hidden',
  },
  // Sidebar
  sidebar: {
    width: 260,
    minWidth: 260,
    borderRight: '1px solid #1e1e2e',
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(0,0,0,0.15)',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 12px',
    borderBottom: '1px solid #1e1e2e',
  },
  sidebarTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#a1a1aa',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  newBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: '1px solid #27272a',
    background: 'transparent',
    color: '#a1a1aa',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionList: {
    flex: 1,
    overflow: 'auto',
    padding: '8px 0',
  },
  sessionItem: {
    padding: '10px 12px',
    cursor: 'pointer',
    borderLeft: '3px solid transparent',
    position: 'relative' as const,
    transition: 'all 0.15s',
  },
  sessionActive: {
    borderLeftColor: '#6C5CE7',
    background: 'rgba(108, 92, 231, 0.08)',
  },
  sessionTitle: {
    fontSize: 13,
    color: '#e4e4e7',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    paddingRight: 24,
  },
  sessionMeta: {
    fontSize: 11,
    color: '#52525b',
    marginTop: 2,
  },
  deleteBtn: {
    position: 'absolute' as const,
    right: 8,
    top: 10,
    width: 20,
    height: 20,
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: '#52525b',
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  emptyList: {
    textAlign: 'center' as const,
    color: '#3f3f46',
    fontSize: 13,
    padding: '24px 12px',
  },
  // Main
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '0 24px',
    position: 'relative' as const,
  },
  toggleBtn: {
    position: 'absolute' as const,
    left: 4,
    top: 8,
    width: 24,
    height: 24,
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: '#52525b',
    fontSize: 12,
    cursor: 'pointer',
  },
  title: { fontSize: 28, fontWeight: 700, margin: '0 0 16px', color: '#f4f4f5', paddingTop: 4 },
  messagesContainer: { flex: 1, overflow: 'auto', paddingBottom: 16 },
  empty: { textAlign: 'center' as const, color: '#52525b', marginTop: 100 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  message: { padding: '12px 16px', borderRadius: 12, marginBottom: 8, maxWidth: '80%' },
  userMsg: { background: 'rgba(108, 92, 231, 0.15)', marginLeft: 'auto' },
  assistantMsg: { background: 'rgba(255,255,255,0.04)', marginRight: 'auto' },
  msgRole: { fontSize: 12, color: '#71717a', marginBottom: 4, fontWeight: 600 },
  msgContent: { fontSize: 14, lineHeight: '1.6', whiteSpace: 'pre-wrap' as const },
  typing: { fontSize: 13, color: '#71717a', fontStyle: 'italic' as const, padding: '8px 16px' },
  inputRow: { display: 'flex', gap: 8, paddingTop: 16, borderTop: '1px solid #1e1e2e' },
  input: {
    flex: 1, padding: '12px 16px', borderRadius: 10, border: '1px solid #27272a',
    background: '#18181b', color: '#f4f4f5', fontSize: 14, outline: 'none',
  },
  sendBtn: {
    padding: '12px 24px', borderRadius: 10, border: 'none',
    background: '#6C5CE7', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14,
  },
};
