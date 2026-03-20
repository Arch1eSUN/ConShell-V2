/**
 * AgendaPostureProvider — Round 19.8
 *
 * Reads from CommitmentStore to produce a canonical AgendaPosture snapshot.
 * This bridges the agenda subsystem into the unified truth surface.
 *
 * "The agenda is not a schedule — it is the lifeform's declared intentions,
 *  filtered by survival pressure."
 */
import type { CommitmentStore } from './commitment-store.js';
import type { AgendaPostureProvider, AgendaPosture } from '../api-surface/agent-posture-service.js';
import { TERMINAL_STATUSES } from './commitment-model.js';

export class DefaultAgendaPostureProvider implements AgendaPostureProvider {
  constructor(private readonly store: CommitmentStore) {}

  getPosture(): AgendaPosture {
    const all = this.store.list();

    // Count by status category
    let scheduled = 0;
    let deferred = 0;
    let active = 0;
    let blocked = 0;
    let nextHint: string | null = null;
    let nextPriority: string | null = null;

    for (const c of all) {
      if (TERMINAL_STATUSES.includes(c.status)) continue;

      switch (c.status) {
        case 'planned':
          scheduled++;
          // Track highest-priority planned item as "next"
          if (!nextHint || (c.priority === 'critical' || c.priority === 'high')) {
            nextHint = c.name;
            nextPriority = c.priority;
          }
          break;
        case 'active':
          active++;
          break;
        case 'blocked':
          // Blocked commitments count as both blocked and deferred
          // (from operator perspective, blocked = deferred execution)
          blocked++;
          deferred++;
          break;
      }
    }

    // Derive priority reason from commitment landscape
    const priorityReason = this.derivePriorityReason(active, scheduled, deferred, blocked);

    return {
      scheduled,
      deferred,
      active,
      blocked,
      nextCommitmentHint: nextHint ?? 'none',
      priorityReason,
    };
  }

  private derivePriorityReason(
    active: number,
    scheduled: number,
    deferred: number,
    blocked: number,
  ): string {
    if (blocked > 0 && blocked >= scheduled) return 'blocked commitments dominate';
    if (deferred > scheduled && scheduled > 0) return 'high deferral pressure';
    if (active > 0) return 'active execution in progress';
    if (scheduled > 0) return 'commitments awaiting execution';
    if (deferred > 0) return 'all commitments deferred';
    return 'no active commitments';
  }
}
