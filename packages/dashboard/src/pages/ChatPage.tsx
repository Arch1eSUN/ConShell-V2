/**
 * ChatPage — Session-aware conversation interface
 * Uses V2 design tokens (warm paper theme)
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Plus, Trash2, PanelLeftClose, PanelLeftOpen, Send } from 'lucide-react';
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
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    return localStorage.getItem(SESSION_KEY) || generateSessionId();
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem(SESSION_KEY, currentSessionId); }, [currentSessionId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadSessions = useCallback(async () => {
    try { const data = await api.listSessions(50, 0); setSessions(data.sessions); } catch {}
  }, []);
  useEffect(() => { loadSessions(); }, [loadSessions]);

  const loadTranscript = useCallback(async (sessionId: string) => {
    try {
      const data = await api.getTranscript(sessionId);
      setMessages(data.turns.map((t: TurnItem) => ({
        role: t.role, content: t.content ?? '', timestamp: new Date(t.created_at).getTime(),
        cost: t.cost_cents > 0 ? t.cost_cents : undefined,
      })));
    } catch { setMessages([]); }
  }, []);
  useEffect(() => { loadTranscript(currentSessionId); }, [currentSessionId, loadTranscript]);

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
          if (last?.role === 'assistant') { copy[copy.length - 1] = { ...last, content: fullResponse }; }
          else { copy.push({ role: 'assistant', content: fullResponse, timestamp: Date.now() }); }
          return copy;
        });
      }
    } catch (err) {
      fullResponse = `Error: ${err instanceof Error ? err.message : String(err)}`;
      setMessages(prev => [...prev, { role: 'assistant', content: fullResponse, timestamp: Date.now() }]);
    }
    setStreaming(false);
    loadSessions();
  };

  const newSession = () => { setCurrentSessionId(generateSessionId()); setMessages([]); };
  const switchSession = (id: string) => { if (id !== currentSessionId) setCurrentSessionId(id); };
  const deleteSession = async (id: string) => {
    try { await api.deleteSession(id); setSessions(prev => prev.filter(s => s.id !== id)); if (id === currentSessionId) newSession(); } catch {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="page-header" style={{ flexShrink: 0, marginBottom: 'var(--space-md)' }}>
        <span className="page-label label">Communication</span>
        <h2 className="page-title">Terminal</h2>
        <p className="page-subtitle">Direct CLI interaction and session memory</p>
      </header>

      <div className="card" style={{ flex: 1, display: 'flex', padding: 0, overflow: 'hidden', gap: 0, minHeight: 0 }}>
        {/* Sessions sidebar */}
        <div style={{ 
          width: sidebarOpen ? 260 : 0, 
          minWidth: sidebarOpen ? 260 : 0,
          borderRight: sidebarOpen ? '1px solid var(--border)' : 'none',
          display: 'flex', flexDirection: 'column', 
          background: 'var(--surface-alt)',
          transition: 'width 0.3s ease, min-width 0.3s ease',
          overflow: 'hidden'
        }}>
          <div style={cs.sidebarHeader}>
            <span className="data-label" style={{ fontSize: '0.6875rem' }}>Sessions</span>
            <button className="btn" style={{ padding: '6px' }} onClick={newSession} title="New conversation"><Plus size={14} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
            {sessions.map(session => (
              <div
                key={session.id}
                style={{ ...cs.sessionItem, ...(session.id === currentSessionId ? cs.sessionActive : {}) }}
                onClick={() => switchSession(session.id)}
              >
                <div style={cs.sessionTitle}>{session.title || 'Untitled'}</div>
                <div style={cs.sessionMeta}>{session.message_count} msgs · {new Date(session.updated_at).toLocaleDateString()}</div>
                <button style={cs.deleteBtn} onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }} title="Delete">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {sessions.length === 0 && <div style={{ textAlign: 'center', color: 'var(--ink-muted)', fontSize: 13, padding: '24px 12px' }}>No sessions yet</div>}
          </div>
        </div>

        {/* Main chat */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', background: 'var(--surface)' }}>
          {/* Internal Chat Header */}
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: 'var(--space-md)', 
            padding: '16px 20px', borderBottom: '1px solid var(--border)',
            background: 'var(--surface-alt)'
          }}>
            <button className="btn" style={{ padding: '8px' }} onClick={() => setSidebarOpen(!sidebarOpen)} title={sidebarOpen ? 'Hide Sessions' : 'Show Sessions'}>
              {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="card-icon green" style={{ width: 24, height: 24 }}><MessageSquare size={12} /></div>
              <span className="card-title" style={{ fontSize: '0.875rem' }}>Active Session</span>
            </div>
            {currentSessionId && <span className="mono" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-muted)' }}>ID: {currentSessionId.split('-')[0]}</span>}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.length === 0 && (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--ink-muted)' }}>
                <MessageSquare size={40} style={{ opacity: 0.2, marginBottom: 16 }} />
                <p>Start a conversation with your agent</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ ...cs.msg, ...(msg.role === 'user' ? cs.userMsg : cs.assistantMsg) }}>
                <div className="data-label" style={{ marginBottom: 6, opacity: 0.7 }}>{msg.role === 'user' ? 'You' : 'Agent'}</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: msg.role === 'user' ? '#fff' : 'var(--ink)' }}>{msg.content}</div>
                {msg.cost && msg.role === 'assistant' && (
                  <div style={{ fontSize: 10, marginTop: 8, color: 'var(--ink-muted)', textAlign: 'right' }}>
                    Cost: ${(msg.cost / 100).toFixed(4)}
                  </div>
                )}
              </div>
            ))}
            {streaming && <div style={{ ...cs.msg, ...cs.assistantMsg, opacity: 0.7 }}><div className="spinning" style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'var(--ink)', boxShadow: '8px 0 0 var(--ink), 16px 0 0 var(--ink)' }} /></div>}
            <div ref={endRef} />
          </div>

          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-alt)' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <input
                style={cs.input}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Type a command or message…"
                disabled={streaming}
              />
              <button className="btn btn-primary" style={{ padding: '0 20px', height: 44 }} onClick={sendMessage} disabled={streaming || !input.trim()}>
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const cs: Record<string, React.CSSProperties> = {
  sidebarHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
  },
  sessionItem: {
    padding: '12px 20px', cursor: 'pointer', borderLeft: '3px solid transparent',
    position: 'relative', transition: 'all 0.15s',
  },
  sessionActive: {
    borderLeftColor: 'var(--green)', background: 'var(--surface)',
  },
  sessionTitle: {
    fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden',
    textOverflow: 'ellipsis', paddingRight: 24, fontWeight: 500
  },
  sessionMeta: { fontSize: 11, color: 'var(--ink-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' },
  deleteBtn: {
    position: 'absolute', right: 12, top: 'calc(50% - 12px)', width: 24, height: 24, borderRadius: 'var(--radius)',
    border: 'none', background: 'transparent', color: 'var(--rose)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, transition: 'opacity 0.2s'
  },
  msg: { padding: '14px 18px', borderRadius: 'var(--radius-lg)', maxWidth: '75%', wordBreak: 'break-word' },
  userMsg: { background: 'var(--green)', color: '#fff', marginLeft: 'auto', borderBottomRightRadius: 4 },
  assistantMsg: { background: 'var(--surface-alt)', border: '1px solid var(--border)', marginRight: 'auto', borderBottomLeftRadius: 4 },
  input: {
    flex: 1, padding: '0 16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-strong)',
    background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, outline: 'none', height: 44,
    fontFamily: 'var(--font-ui)', transition: 'border-color 0.2s',
  },
};
