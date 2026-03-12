/**
 * ChatPage — 对话界面
 */
import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  cost?: number;
}

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: Date.now() }]);
    setStreaming(true);

    let fullResponse = '';
    try {
      for await (const chunk of api.chatStream(text)) {
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
  };

  return (
    <div style={s.container}>
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
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' },
  title: { fontSize: 28, fontWeight: 700, margin: '0 0 16px', color: '#f4f4f5' },
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
