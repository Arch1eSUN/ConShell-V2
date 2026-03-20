import { useState, useEffect } from 'react';
import { HeartPulse, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { api } from '../api';

interface HealthCheck { name: string; status: 'pass' | 'warn' | 'fail'; message: string; }

export function HealthPage() {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.health().then(h => {
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

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'pass') return <CheckCircle2 size={16} style={{ color: 'var(--green)' }} />;
    if (status === 'warn') return <AlertTriangle size={16} style={{ color: 'var(--amber)' }} />;
    return <XCircle size={16} style={{ color: 'var(--rose)' }} />;
  };

  return (
    <div>
      <header className="page-header">
        <span className="page-label label">System</span>
        <h2 className="page-title">Health</h2>
        <p className="page-subtitle">System health checks and diagnostics</p>
      </header>

      {loading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: 10 }} />
      ) : (
        <div className="card">
          <div className="card-header">
            <div className="card-icon green"><HeartPulse size={16} /></div>
            <span className="card-title">Health Checks</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {checks.map(check => (
              <div key={check.name} className="list-row">
                <StatusIcon status={check.status} />
                <span style={{ fontWeight: 500, fontSize: 14, flex: 1, color: 'var(--ink)' }}>{check.name}</span>
                <code className="mono" style={{
                  color: check.status === 'pass' ? 'var(--green-text)' : check.status === 'warn' ? 'var(--amber-text)' : 'var(--rose-text)',
                }}>{check.message}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 'var(--space-lg)', background: 'var(--green-bg)' }}>
        <p style={{ fontSize: 14, color: 'var(--ink-secondary)' }}>
          💡 Run <code style={{ background: 'var(--surface)', padding: '2px 8px', borderRadius: 4, fontSize: 13, color: 'var(--ink)' }}>conshell doctor</code> for a comprehensive health check.
        </p>
      </div>
    </div>
  );
}
