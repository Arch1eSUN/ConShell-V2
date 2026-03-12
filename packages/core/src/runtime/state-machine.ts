/**
 * 状态机 — Agent生命周期管理
 *
 * 5状态: Setup → Waking → Running → Sleeping → Dead
 * 状态转换由事件驱动 + SurvivalTier联动
 */
import type { Logger } from '../types/common.js';

// ── Types ─────────────────────────────────────────────────────────────

export type AgentLifecycleState = 'setup' | 'waking' | 'running' | 'sleeping' | 'dead';

export type LifecycleEvent =
  | 'boot'         // setup → waking
  | 'ready'        // waking → running
  | 'sleep'        // running → sleeping
  | 'wake'         // sleeping → waking
  | 'die'          // any → dead
  | 'reset';       // dead → setup

export interface StateTransition {
  from: AgentLifecycleState;
  to: AgentLifecycleState;
  event: LifecycleEvent;
  timestamp: string;
}

export type StateChangeListener = (transition: StateTransition) => void;

// ── Transition table ──────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<AgentLifecycleState, Partial<Record<LifecycleEvent, AgentLifecycleState>>> = {
  setup:    { boot: 'waking', die: 'dead' },
  waking:   { ready: 'running', die: 'dead' },
  running:  { sleep: 'sleeping', die: 'dead' },
  sleeping: { wake: 'waking', die: 'dead' },
  dead:     { reset: 'setup' },
};

// ── StateMachine ──────────────────────────────────────────────────────

export class AgentStateMachine {
  private _state: AgentLifecycleState = 'setup';
  private _history: StateTransition[] = [];
  private _listeners: StateChangeListener[] = [];
  private logger: Logger;
  private maxHistory: number;

  constructor(logger: Logger, maxHistory = 100) {
    this.logger = logger.child('state-machine');
    this.maxHistory = maxHistory;
  }

  get state(): AgentLifecycleState {
    return this._state;
  }

  get history(): readonly StateTransition[] {
    return this._history;
  }

  /** 尝试状态转换 */
  transition(event: LifecycleEvent): boolean {
    const validNext = VALID_TRANSITIONS[this._state]?.[event];

    if (!validNext) {
      this.logger.warn('Invalid state transition', {
        current: this._state,
        event,
        validEvents: Object.keys(VALID_TRANSITIONS[this._state] ?? {}),
      });
      return false;
    }

    const transition: StateTransition = {
      from: this._state,
      to: validNext,
      event,
      timestamp: new Date().toISOString(),
    };

    this.logger.info('State transition', { ...transition });
    this._state = validNext;

    // Record history
    this._history.push(transition);
    if (this._history.length > this.maxHistory) {
      this._history.shift();
    }

    // Notify listeners
    for (const listener of this._listeners) {
      try {
        listener(transition);
      } catch (err) {
        this.logger.error('State listener error', { error: String(err) });
      }
    }

    return true;
  }

  /** 注册状态变化监听 */
  onStateChange(listener: StateChangeListener): () => void {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  /** 是否处于活跃状态 */
  isAlive(): boolean {
    return this._state !== 'dead';
  }

  /** 是否可以接受用户请求 */
  isReady(): boolean {
    return this._state === 'running';
  }

  /** 快速引导到 running */
  boot(): boolean {
    const booted = this.transition('boot');
    if (booted) return this.transition('ready');
    return false;
  }
}
