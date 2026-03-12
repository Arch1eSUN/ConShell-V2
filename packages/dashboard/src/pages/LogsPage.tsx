/**
 * LogsPage — WebSocket实时日志
 */
import React, { useRef, useEffect, useState } from 'react';

interface LogMessage {
  type: string;
  data: any;
  timestamp: number;
}

interface LogsPageProps {
  messages: LogMessage[];
}

type LogLevel = 'all' | 'info' | 'warn' | 'error' | 'debug';

export function LogsPage({ messages }: LogsPageProps) {
  const [filter, setFilter] = useState<LogLevel>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, autoScroll]);

  const filtered = filter === 'all'
    ? messages
    : messages.filter(m => (m.data?.level ?? m.type) === filter);

  return (
    <div style={s.container}>
      <div style={s.header}>
        <h1 style={s.title}>Logs</h1>
        <div style={s.controls}>
          <select style={s.select} value={filter} onChange={e => setFilter(e.target.value as LogLevel)}>
            <option value="all">All</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
          <label style={s.toggle}>
            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
            Auto-scroll
          </label>
        </div>
      </div>

      <div style={s.logContainer}>
        {filtered.length === 0 ? (
          <div style={s.empty}>No log entries yet. Logs stream via WebSocket.</div>
        ) : (
          filtered.map((msg, i) => {
            const level = msg.data?.level ?? msg.type;
            const time = new Date(msg.timestamp).toLocaleTimeString();
            const text = msg.data?.message ?? msg.data?.text ?? JSON.stringify(msg.data);
            return (
              <div key={i} style={s.logLine}>
                <span style={s.time}>{time}</span>
                <span style={{ ...s.level, color: levelColor(level) }}>{(level ?? 'LOG').toUpperCase().padEnd(5)}</span>
                <span style={s.text}>{text}</span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function levelColor(level: string): string {
  switch (level) {
    case 'error': return '#ef4444';
    case 'warn': return '#f59e0b';
    case 'info': return '#3b82f6';
    case 'debug': return '#6b7280';
    default: return '#a1a1aa';
  }
}

const s: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 700, color: '#f4f4f5', margin: 0 },
  controls: { display: 'flex', gap: 16, alignItems: 'center' },
  select: { padding: '6px 12px', borderRadius: 6, border: '1px solid #27272a', background: '#18181b', color: '#a1a1aa', fontSize: 13 },
  toggle: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#a1a1aa', cursor: 'pointer' },
  logContainer: {
    flex: 1, overflow: 'auto', background: '#09090b', borderRadius: 12,
    border: '1px solid #1e1e2e', padding: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
  },
  empty: { color: '#52525b', textAlign: 'center' as const, padding: 48 },
  logLine: { display: 'flex', gap: 12, padding: '3px 0', lineHeight: 1.6 },
  time: { color: '#52525b', flexShrink: 0 },
  level: { fontWeight: 600, flexShrink: 0, width: 50 },
  text: { color: '#d4d4d8', wordBreak: 'break-all' as const },
};
