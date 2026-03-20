import { useState, useEffect } from 'react';
import { ListTodo, Clock, Loader2, CheckCircle2, XCircle, Ban, RefreshCw } from 'lucide-react';
import { api } from '../api';

interface Task {
  id: string; type: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'cancelled';
  description: string; progress?: number;
  result?: string; error?: string;
  createdAt: string; completedAt?: string;
}

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadTasks = () => {
    api.rawRequest<{ tasks: Task[] }>('/api/tasks')
      .then(data => setTasks(data.tasks ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTasks(); const timer = setInterval(loadTasks, 5000); return () => clearInterval(timer); }, []);

  const cancelTask = async (id: string) => {
    try { await api.rawRequest(`/api/tasks/${id}/cancel`, { method: 'POST' }); loadTasks(); } catch {}
  };

  const filtered = statusFilter === 'all' ? tasks : tasks.filter(t => t.status === statusFilter);

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'pending': return <Clock size={14} style={{ color: 'var(--amber)' }} />;
      case 'running': return <Loader2 size={14} style={{ color: 'var(--blue)' }} className="spinning" />;
      case 'done': return <CheckCircle2 size={14} style={{ color: 'var(--green)' }} />;
      case 'failed': return <XCircle size={14} style={{ color: 'var(--rose)' }} />;
      case 'cancelled': return <Ban size={14} style={{ color: 'var(--ink-muted)' }} />;
      default: return null;
    }
  };

  const selectStyle: React.CSSProperties = {
    padding: '6px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border-strong)',
    background: 'var(--surface)', color: 'var(--ink-secondary)', fontSize: 13, fontFamily: 'var(--font-ui)',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
        <header className="page-header" style={{ marginBottom: 0 }}>
          <span className="page-label label">Queue</span>
          <h2 className="page-title">Tasks</h2>
        </header>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select style={selectStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All</option><option value="pending">Pending</option><option value="running">Running</option>
            <option value="done">Done</option><option value="failed">Failed</option>
          </select>
          <button onClick={loadTasks} style={{ ...selectStyle, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><RefreshCw size={14} /></button>
        </div>
      </div>
      <p className="page-subtitle" style={{ marginBottom: 'var(--space-lg)' }}>{tasks.length} total · {tasks.filter(t => t.status === 'running').length} running</p>

      {loading ? <div className="skeleton" style={{ height: 200, borderRadius: 10 }} /> : filtered.length === 0 ? (
        <div style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: 48, fontSize: 14 }}>
          <ListTodo size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
          <p>No tasks{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {filtered.map(task => (
            <div key={task.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 14,
              padding: '14px 20px', borderBottom: '1px solid var(--border)',
            }}>
              <StatusIcon status={task.status} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--ink)' }}>{task.description || task.type}</div>
                <div className="data-label" style={{ marginTop: 4 }}>
                  {task.id.slice(0, 8)} · {task.type} · {new Date(task.createdAt).toLocaleString()}
                </div>
                {task.progress != null && task.status === 'running' && (
                  <div style={{ height: 4, background: 'var(--surface)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--blue)', borderRadius: 2, transition: 'width 0.3s', width: `${task.progress}%` }} />
                  </div>
                )}
                {task.error && <div style={{ fontSize: 12, color: 'var(--rose)', marginTop: 4 }}>{task.error}</div>}
              </div>
              {(task.status === 'pending' || task.status === 'running') && (
                <button onClick={() => cancelTask(task.id)} style={{
                  padding: '4px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--rose)',
                  background: 'transparent', color: 'var(--rose)', cursor: 'pointer', fontSize: 12,
                }}>Cancel</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
