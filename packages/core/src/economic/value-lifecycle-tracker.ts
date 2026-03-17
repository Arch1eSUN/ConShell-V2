/**
 * Round 16.0 — Value Realization Lifecycle Tracker
 *
 * Tracks per-task lifecycle stages using a dual-track model:
 *   Revenue track:     planned → completed → realized → recognized → retained
 *   Non-revenue track: planned → completed → retained
 *
 * Provides realization gap analysis and stage distribution reporting.
 */

// ── Types ─────────────────────────────────────────────────────────────

export type LifecycleStage = 'planned' | 'completed' | 'realized' | 'recognized' | 'retained';
export type LifecycleTrack = 'revenue' | 'non-revenue';

export interface LifecycleEntry {
  readonly taskId: string;
  readonly taskName: string;
  readonly taskType: string;
  readonly track: LifecycleTrack;
  currentStage: LifecycleStage;
  readonly stages: Partial<Record<LifecycleStage, string>>;  // stage → timestamp
}

// ── Stage validation ──────────────────────────────────────────────────

const REVENUE_STAGES: readonly LifecycleStage[] = ['planned', 'completed', 'realized', 'recognized', 'retained'];
const NON_REVENUE_STAGES: readonly LifecycleStage[] = ['planned', 'completed', 'retained'];

function isValidTransition(track: LifecycleTrack, from: LifecycleStage, to: LifecycleStage): boolean {
  const stages = track === 'revenue' ? REVENUE_STAGES : NON_REVENUE_STAGES;
  const fromIdx = stages.indexOf(from);
  const toIdx = stages.indexOf(to);
  // Must move forward, and target must be in track's stage list
  return fromIdx >= 0 && toIdx > fromIdx;
}

// ── Tracker ───────────────────────────────────────────────────────────

export class ValueLifecycleTracker {
  private entries = new Map<string, LifecycleEntry>();
  private maxEntries: number;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Register a task as planned, selecting its lifecycle track.
   */
  plan(taskId: string, taskName: string, taskType: string, isRevenue: boolean): void {
    const now = new Date().toISOString();
    const track: LifecycleTrack = isRevenue ? 'revenue' : 'non-revenue';

    // Evict oldest if at capacity
    if (this.entries.size >= this.maxEntries) {
      const first = this.entries.keys().next().value;
      if (first !== undefined) this.entries.delete(first);
    }

    this.entries.set(taskId, {
      taskId,
      taskName,
      taskType,
      track,
      currentStage: 'planned',
      stages: { planned: now },
    });
  }

  /**
   * Advance a task to the next lifecycle stage.
   * Validates track-appropriate transitions.
   * Returns true if the advance was valid, false otherwise.
   */
  advance(taskId: string, to: LifecycleStage): boolean {
    const entry = this.entries.get(taskId);
    if (!entry) return false;

    if (!isValidTransition(entry.track, entry.currentStage, to)) {
      return false;
    }

    entry.currentStage = to;
    (entry.stages as Record<string, string>)[to] = new Date().toISOString();
    return true;
  }

  /** Get a specific entry */
  getEntry(taskId: string): LifecycleEntry | undefined {
    return this.entries.get(taskId);
  }

  /**
   * Realization gap: among revenue-track tasks that completed,
   * how many actually got realized?
   */
  getRealizationGap(): { total: number; realized: number; gapPct: number } {
    let total = 0;
    let realized = 0;

    for (const entry of this.entries.values()) {
      if (entry.track !== 'revenue') continue;
      const stageIdx = REVENUE_STAGES.indexOf(entry.currentStage);
      // At least completed
      if (stageIdx >= 1) {
        total++;
        // At least realized
        if (stageIdx >= 2) realized++;
      }
    }

    return {
      total,
      realized,
      gapPct: total > 0 ? Math.round((1 - realized / total) * 100) : 0,
    };
  }

  /** Distribution of tasks across stages */
  getStageDistribution(): Record<LifecycleStage, number> {
    const dist: Record<LifecycleStage, number> = {
      planned: 0, completed: 0, realized: 0, recognized: 0, retained: 0,
    };
    for (const entry of this.entries.values()) {
      dist[entry.currentStage]++;
    }
    return dist;
  }

  /** Recently completed/advanced entries */
  getRecentCompleted(limit = 10): readonly LifecycleEntry[] {
    const completed: LifecycleEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.currentStage !== 'planned') {
        completed.push(entry);
      }
    }
    return completed.slice(-limit);
  }

  /** Total tracked entries */
  get size(): number {
    return this.entries.size;
  }

  /** Clear all entries (for testing) */
  clear(): void {
    this.entries.clear();
  }
}
