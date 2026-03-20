import { useRef, useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';

interface LogMessage { type: string; data: any; timestamp: number; }
interface LogsPageProps { messages: LogMessage[]; }
type LogLevel = 'all' | 'info' | 'warn' | 'error' | 'debug';

export function LogsPage({ messages }: LogsPageProps) {
  const [filter, setFilter] = useState<LogLevel>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (autoScroll) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, autoScroll]);

  const filtered = filter === 'all' ? messages : messages.filter(m => (m.data?.level ?? m.type) === filter);

  const levelColor = (l: string) => {
    switch (l) { case 'error': return 'var(--rose)'; case 'warn': return 'var(--amber)'; case 'info': return 'var(--blue)'; case 'debug': return 'var(--ink-muted)'; default: return 'var(--ink-secondary)'; }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 96px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
        <div className="card-header" style={{ margin: 0 }}>
          <div className="card-icon blue"><ScrollText size={16} /></div>
          <span className="card-title">Logs</span>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <select value={filter} onChange={e => setFilter(e.target.value as LogLevel)} style={{
            padding: '6px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border-strong)',
            background: 'var(--surface)', color: 'var(--ink-secondary)', fontSize: 13, fontFamily: 'var(--font-ui)',
          }}>
            <option value="all">All</option><option value="info">Info</option><option value="warn">Warning</option><option value="error">Error</option><option value="debug">Debug</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} /> Auto-scroll
          </label>
        </div>
      </div>

      <div style={{
        flex: 1, overflow: 'auto', background: 'var(--sidebar-bg)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-strong)', padding: 12, fontFamily: 'var(--font-mono)', fontSize: 13,
      }}>
        {filtered.length === 0 ? (
          <div style={{ color: 'var(--sidebar-muted)', textAlign: 'center', padding: 48 }}>No log entries yet. Logs stream via WebSocket.</div>
        ) : filtered.map((msg, i) => {
          const level = msg.data?.level ?? msg.type;
          const time = new Date(msg.timestamp).toLocaleTimeString();
          const text = msg.data?.message ?? msg.data?.text ?? JSON.stringify(msg.data);
          return (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '3px 0', lineHeight: 1.6 }}>
              <span style={{ color: 'var(--sidebar-muted)', flexShrink: 0 }}>{time}</span>
              <span style={{ fontWeight: 600, flexShrink: 0, width: 50, color: levelColor(level) }}>{(level ?? 'LOG').toUpperCase().padEnd(5)}</span>
              <span style={{ color: 'var(--sidebar-text-hover)', wordBreak: 'break-all' }}>{text}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
