/**
 * WakeSemantics — Round 19.2 G1
 *
 * Durable wake-trigger and scheduled autonomy for the high-trust
 * autonomy closure. Manages:
 *
 * 1. WAKE TRIGGERS — conditions that cause the agent to re-activate
 * 2. SCHEDULED AUTONOMY — time-based triggers (cron-like semantics)
 * 3. EVENT-BASED TRIGGERS — reactive triggers from state changes
 * 4. MISSION CONTINUITY — long-horizon missions that span wake cycles
 *
 * WakeSemantics bridges the gap between durable agenda state and
 * the volatile runtime — ensuring that the agent can "go to sleep"
 * and reliably "wake up" when conditions are met.
 *
 * "An agent that cannot wake itself is not autonomous."
 */
import type { Logger } from '../types/common.js';

// ── Trigger Types ───────────────────────────────────────────────────

export type TriggerKind =
  | 'scheduled'         // fire at a specific time
  | 'interval'          // fire every N milliseconds
  | 'event'             // fire when a named event occurs
  | 'condition'         // fire when a condition function returns true
  | 'commitment_due'    // fire when a commitment's dueAt is reached
  | 'survival_change'   // fire when survival tier changes
  | 'mission_checkpoint'; // fire at mission checkpoint intervals

export type TriggerStatus = 'armed' | 'fired' | 'expired' | 'cancelled';

export interface WakeTrigger {
  readonly id: string;
  readonly kind: TriggerKind;
  readonly description: string;
  status: TriggerStatus;

  /** For 'scheduled' — ISO-8601 fire time */
  readonly fireAt?: string;
  /** For 'interval' — milliseconds between fires */
  readonly intervalMs?: number;
  /** For 'event' — event name to listen for */
  readonly eventName?: string;
  /** For 'commitment_due' — linked commitment ID */
  readonly commitmentId?: string;
  /** For 'mission_checkpoint' — mission ID */
  readonly missionId?: string;

  /** Number of times this trigger has fired */
  fireCount: number;
  /** Maximum fires before auto-expire (0 = unlimited) */
  readonly maxFires: number;

  readonly createdAt: string;
  lastFiredAt?: string;
}

// ── Mission Continuity ──────────────────────────────────────────────

export interface Mission {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly commitmentIds: string[];
  status: 'active' | 'paused' | 'completed' | 'failed';
  readonly checkpointIntervalMs: number;
  lastCheckpointAt?: string;
  progress: number; // 0-100
  readonly createdAt: string;
}

// ── WakeSemantics ───────────────────────────────────────────────────

export class WakeSemantics {
  private triggers = new Map<string, WakeTrigger>();
  private missions = new Map<string, Mission>();
  private firedLog: { triggerId: string; firedAt: string; result: string }[] = [];
  private idCounter = 0;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  // ── Trigger Registration ──────────────────────────────────────────

  registerTrigger(input: {
    kind: TriggerKind;
    description: string;
    fireAt?: string;
    intervalMs?: number;
    eventName?: string;
    commitmentId?: string;
    missionId?: string;
    maxFires?: number;
  }): WakeTrigger {
    const id = `wt_${++this.idCounter}`;
    const trigger: WakeTrigger = {
      id,
      kind: input.kind,
      description: input.description,
      status: 'armed',
      fireAt: input.fireAt,
      intervalMs: input.intervalMs,
      eventName: input.eventName,
      commitmentId: input.commitmentId,
      missionId: input.missionId,
      fireCount: 0,
      maxFires: input.maxFires ?? 1,
      createdAt: new Date().toISOString(),
    };

    this.triggers.set(id, trigger);
    this.logger.info('Wake trigger registered', { id, kind: input.kind, description: input.description });
    return trigger;
  }

  cancelTrigger(id: string): boolean {
    const trigger = this.triggers.get(id);
    if (!trigger || trigger.status !== 'armed') return false;
    trigger.status = 'cancelled';
    this.logger.info('Wake trigger cancelled', { id });
    return true;
  }

  // ── Trigger Evaluation ────────────────────────────────────────────

  /**
   * Evaluate all armed triggers against current time and emit any that should fire.
   * Returns IDs of triggers that fired.
   */
  evaluateScheduled(now: string = new Date().toISOString()): string[] {
    const fired: string[] = [];

    for (const trigger of this.triggers.values()) {
      if (trigger.status !== 'armed') continue;

      let shouldFire = false;

      if (trigger.kind === 'scheduled' && trigger.fireAt) {
        shouldFire = now >= trigger.fireAt;
      } else if (trigger.kind === 'interval' && trigger.intervalMs) {
        const lastFire = trigger.lastFiredAt ?? trigger.createdAt;
        const elapsed = new Date(now).getTime() - new Date(lastFire).getTime();
        shouldFire = elapsed >= trigger.intervalMs;
      } else if (trigger.kind === 'commitment_due' && trigger.fireAt) {
        shouldFire = now >= trigger.fireAt;
      }

      if (shouldFire) {
        this.fireTrigger(trigger, now);
        fired.push(trigger.id);
      }
    }

    return fired;
  }

  /**
   * Fire an event-based trigger by name.
   */
  fireEvent(eventName: string): string[] {
    const now = new Date().toISOString();
    const fired: string[] = [];

    for (const trigger of this.triggers.values()) {
      if (trigger.status !== 'armed') continue;
      if (trigger.kind === 'event' && trigger.eventName === eventName) {
        this.fireTrigger(trigger, now);
        fired.push(trigger.id);
      }
      if (trigger.kind === 'survival_change' && eventName.startsWith('survival:')) {
        this.fireTrigger(trigger, now);
        fired.push(trigger.id);
      }
    }

    return fired;
  }

  // ── Mission Management ────────────────────────────────────────────

  registerMission(input: {
    name: string;
    description: string;
    commitmentIds: string[];
    checkpointIntervalMs?: number;
  }): Mission {
    const id = `mis_${++this.idCounter}`;
    const mission: Mission = {
      id,
      name: input.name,
      description: input.description,
      commitmentIds: [...input.commitmentIds],
      status: 'active',
      checkpointIntervalMs: input.checkpointIntervalMs ?? 3600000, // 1 hour default
      progress: 0,
      createdAt: new Date().toISOString(),
    };

    this.missions.set(id, mission);

    // Auto-register a mission checkpoint trigger
    this.registerTrigger({
      kind: 'mission_checkpoint',
      description: `Checkpoint for mission: ${input.name}`,
      intervalMs: mission.checkpointIntervalMs,
      missionId: id,
      maxFires: 0, // unlimited
    });

    this.logger.info('Mission registered', { id, name: input.name });
    return mission;
  }

  updateMissionProgress(missionId: string, progress: number): void {
    const mission = this.missions.get(missionId);
    if (!mission) return;
    mission.progress = Math.max(0, Math.min(100, progress));
    if (mission.progress >= 100) {
      mission.status = 'completed';
      // Cancel associated triggers
      for (const t of this.triggers.values()) {
        if (t.missionId === missionId && t.status === 'armed') {
          t.status = 'expired';
        }
      }
    }
  }

  getMission(id: string): Mission | undefined {
    return this.missions.get(id);
  }

  activeMissions(): Mission[] {
    return Array.from(this.missions.values()).filter(m => m.status === 'active');
  }

  // ── Queries ───────────────────────────────────────────────────────

  armedTriggers(): WakeTrigger[] {
    return Array.from(this.triggers.values()).filter(t => t.status === 'armed');
  }

  getTrigger(id: string): WakeTrigger | undefined {
    return this.triggers.get(id);
  }

  firedHistory(): readonly { triggerId: string; firedAt: string; result: string }[] {
    return this.firedLog;
  }

  stats() {
    const triggers = Array.from(this.triggers.values());
    return {
      totalTriggers: triggers.length,
      armed: triggers.filter(t => t.status === 'armed').length,
      fired: triggers.filter(t => t.status === 'fired').length,
      expired: triggers.filter(t => t.status === 'expired').length,
      cancelled: triggers.filter(t => t.status === 'cancelled').length,
      totalMissions: this.missions.size,
      activeMissions: this.activeMissions().length,
      totalFires: this.firedLog.length,
    };
  }

  // ── Private ───────────────────────────────────────────────────────

  private fireTrigger(trigger: WakeTrigger, now: string): void {
    trigger.fireCount++;
    trigger.lastFiredAt = now;

    if (trigger.maxFires > 0 && trigger.fireCount >= trigger.maxFires) {
      trigger.status = trigger.kind === 'interval' ? 'armed' : 'fired';
      if (trigger.fireCount >= trigger.maxFires) {
        trigger.status = 'expired';
      }
    }

    // For interval triggers, keep armed until maxFires
    if (trigger.kind === 'interval' && trigger.maxFires === 0) {
      // Unlimited — stays armed
    }

    this.firedLog.push({
      triggerId: trigger.id,
      firedAt: now,
      result: 'fired',
    });

    this.logger.info('Wake trigger fired', {
      id: trigger.id,
      kind: trigger.kind,
      fireCount: trigger.fireCount,
    });
  }
}
