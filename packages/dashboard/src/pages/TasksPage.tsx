/**
 * TasksPage — 异步任务管理
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface Task {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'cancelled';
  description: string;
  progress?: number;
  result?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
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
    try {
      await api.rawRequest(`/api/tasks/${id}/cancel`, { method: 'POST' });
      loadTasks();
    } catch (err) {
      console.error('Cancel failed:', err);
    }
  };

  const filtered = statusFilter === 'all' ? tasks : tasks.filter(t => t.status === statusFilter);

  const statusColors: Record<string, string> = {
    pending: '#fbbf24', running: '#3b82f6', done: '#4ade80', failed: '#ef4444', cancelled: '#71717a',
  };
  const statusIcons: Record<string, string> = {
    pending: '⏳', running: '🔄', done: '✓', failed: '✗', cancelled: '⊘',
  };

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Tasks</h1>
        <div style={s.controls}>
          <select style={s.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="done">Done</option>
            <option value="failed">Failed</option>
          </select>
          <button style={s.refreshBtn} onClick={loadTasks}>🔄</button>
        </div>
      </div>
      <p style={s.subtitle}>{tasks.length} total · {tasks.filter(t => t.status === 'running').length} running</p>

      {loading ? (
        <div style={s.loading}>Loading tasks…</div>
      ) : filtered.length === 0 ? (
        <div style={s.empty}>No tasks{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}.</div>
      ) : (
        <div style={s.list}>
          {filtered.map(task => (
            <div key={task.id} style={s.taskRow}>
              <span style={{ color: statusColors[task.status], fontSize: 16, width: 24 }}>
                {statusIcons[task.status]}
              </span>
              <div style={{ flex: 1 }}>
                <div style={s.taskDesc}>{task.description || task.type}</div>
                <div style={s.taskMeta}>
                  {task.id.slice(0, 8)} · {task.type} · {new Date(task.createdAt).toLocaleString()}
                </div>
                {task.progress != null && task.status === 'running' && (
                  <div style={s.progressBg}>
                    <div style={{ ...s.progressFill, width: `${task.progress}%` }} />
                  </div>
                )}
                {task.error && <div style={s.error}>{task.error}</div>}
              </div>
              {(task.status === 'pending' || task.status === 'running') && (
                <button style={s.cancelBtn} onClick={() => cancelTask(task.id)}>Cancel</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: 700, color: '#f4f4f5', margin: 0 },
  subtitle: { fontSize: 14, color: '#71717a', margin: '0 0 24px' },
  controls: { display: 'flex', gap: 8, alignItems: 'center' },
  select: { padding: '6px 12px', borderRadius: 6, border: '1px solid #27272a', background: '#18181b', color: '#a1a1aa', fontSize: 13 },
  refreshBtn: { padding: '6px 10px', borderRadius: 6, border: '1px solid #27272a', background: 'transparent', cursor: 'pointer', fontSize: 14 },
  loading: { color: '#71717a', padding: 32, textAlign: 'center' as const },
  empty: { color: '#52525b', padding: 48, textAlign: 'center' as const, fontSize: 14 },
  list: { borderRadius: 12, border: '1px solid #1e1e2e', overflow: 'hidden' },
  taskRow: { display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 20px', borderBottom: '1px solid #1e1e2e' },
  taskDesc: { fontWeight: 500, fontSize: 14, color: '#e4e4e7' },
  taskMeta: { fontSize: 12, color: '#52525b', marginTop: 4 },
  progressBg: { height: 4, background: '#27272a', borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', background: '#3b82f6', borderRadius: 2, transition: 'width 0.3s' },
  error: { fontSize: 12, color: '#ef4444', marginTop: 4 },
  cancelBtn: {
    padding: '4px 12px', borderRadius: 6, border: '1px solid #ef4444',
    background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 12,
  },
};
