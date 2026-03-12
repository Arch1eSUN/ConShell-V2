/**
 * HealthPage — Agent健康状态
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

export function HealthPage() {
  const [health, setHealth] = useState<any>(null);
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.health().then(h => {
      setHealth(h);
      // Derive checks from health response
      setChecks([
        { name: 'Server', status: h.status === 'ok' ? 'pass' : h.status === 'degraded' ? 'warn' : 'fail', message: h.status },
        { name: 'Agent', status: h.agent ? 'pass' : 'warn', message: h.agent ?? 'Unknown' },
        { name: 'Uptime', status: h.uptime > 60 ? 'pass' : 'warn', message: `${Math.floor(h.uptime / 60)}m ${h.uptime % 60}s` },
        { name: 'Version', status: 'pass', message: h.version ?? '—' },
      ]);
      setLoading(false);
    }).catch(() => {
      setChecks([{ name: 'Server', status: 'fail', message: 'Cannot connect to ConShell' }]);
      setLoading(false);
    });
  }, []);

  const statusIcons = { pass: '✓', warn: '⚠', fail: '✗' };
  const statusColors = { pass: '#4ade80', warn: '#fbbf24', fail: '#ef4444' };

  return (
    <div>
      <h1 style={s.title}>Health</h1>
      <p style={s.subtitle}>System health checks and diagnostics</p>

      {loading ? (
        <div style={s.loading}>Running health checks…</div>
      ) : (
        <div style={s.checkList}>
          {checks.map(check => (
            <div key={check.name} style={s.checkRow}>
              <span style={{ ...s.icon, color: statusColors[check.status] }}>
                {statusIcons[check.status]}
              </span>
              <span style={s.checkName}>{check.name}</span>
              <span style={{ ...s.checkMsg, color: statusColors[check.status] }}>{check.message}</span>
            </div>
          ))}
        </div>
      )}

      <div style={s.tip}>
        💡 Run <code style={s.code}>conshell doctor</code> for a comprehensive health check.
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  title: { fontSize: 28, fontWeight: 700, margin: '0 0 8px', color: '#f4f4f5' },
  subtitle: { fontSize: 14, color: '#71717a', margin: '0 0 32px' },
  loading: { color: '#71717a', padding: 32 },
  checkList: { background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid #1e1e2e', overflow: 'hidden' },
  checkRow: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #1e1e2e' },
  icon: { fontSize: 18, fontWeight: 700, width: 24, textAlign: 'center' as const },
  checkName: { fontWeight: 600, fontSize: 14, flex: 1, color: '#e4e4e7' },
  checkMsg: { fontSize: 14, fontFamily: 'monospace' },
  tip: { marginTop: 32, padding: 16, background: 'rgba(108,92,231,0.08)', borderRadius: 10, fontSize: 14, color: '#a1a1aa' },
  code: { background: '#27272a', padding: '2px 8px', borderRadius: 4, fontSize: 13, color: '#e4e4e7' },
};
