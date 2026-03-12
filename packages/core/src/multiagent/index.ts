/**
 * MultiAgent — 多Agent管理 (完整版)
 *
 * 功能:
 * - 子Agent生命周期管理 (spawn/pause/resume/terminate)
 * - 谱系追踪 (parent ↔ child lineage tree)
 * - 消息中继 (inbox relay between parent/child)
 * - 资源配额 (限制子Agent数量/资金)
 * - 健康监控 (heartbeat + auto-cleanup)
 */

// ── Types ──────────────────────────────────────────────────────────────

export type ChildState = 'spawning' | 'running' | 'paused' | 'terminated' | 'dead';

export interface ChildAgent {
  id: string;
  name: string;
  state: ChildState;
  task: string;
  /** Parent agent ID (null for root) */
  parentId: string | null;
  /** Child IDs */
  childIds: string[];
  /** Process PID if applicable */
  pid?: number;
  /** Working directory */
  workDir?: string;
  /** Wallet address */
  walletAddress?: string;
  /** Initial fund allocation (cents) */
  fundedCents: number;
  /** Genesis prompt */
  genesisPrompt: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last heartbeat */
  lastHeartbeat: number;
  /** Generation (depth in lineage tree) */
  generation: number;
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'command' | 'report' | 'relay' | 'heartbeat' | 'death_notice';
  payload: unknown;
  timestamp: number;
  read: boolean;
}

export interface SpawnRequest {
  name: string;
  task: string;
  genesisPrompt: string;
  config?: Record<string, unknown>;
  fundCents?: number;
  parentId?: string;
}

export interface MultiAgentConfig {
  /** Maximum number of children per agent */
  maxChildren: number;
  /** Maximum lineage depth */
  maxGenerationDepth: number;
  /** Heartbeat timeout (ms) — mark dead if exceeded */
  heartbeatTimeoutMs: number;
  /** Minimum fund to spawn a child (cents) */
  minSpawnFundCents: number;
  /** Root agent ID */
  rootAgentId: string;
}

export interface MultiAgentStats {
  total: number;
  running: number;
  paused: number;
  terminated: number;
  dead: number;
  maxDepth: number;
}

export interface LineageNode {
  id: string;
  name: string;
  state: ChildState;
  generation: number;
  children: LineageNode[];
}

export type MultiAgentEventType = 'spawn' | 'terminate' | 'death' | 'message' | 'heartbeat_timeout';
export type MultiAgentListener = (type: MultiAgentEventType, data: unknown) => void;

// ── Default Config ─────────────────────────────────────────────────────

const DEFAULT_CONFIG: MultiAgentConfig = {
  maxChildren: 5,
  maxGenerationDepth: 3,
  heartbeatTimeoutMs: 300_000, // 5 min
  minSpawnFundCents: 1000, // $10 minimum
  rootAgentId: 'root',
};

// ── MultiAgentManager ──────────────────────────────────────────────────

export class MultiAgentManager {
  private agents = new Map<string, ChildAgent>();
  private inbox: AgentMessage[] = [];
  private config: MultiAgentConfig;
  private listeners = new Set<MultiAgentListener>();
  private msgIdCounter = 0;
  private healthTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<MultiAgentConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  /**
   * Spawn a new child agent
   */
  async spawn(req: SpawnRequest): Promise<ChildAgent> {
    const parentId = req.parentId ?? this.config.rootAgentId;

    // Check max children
    const parent = this.agents.get(parentId);
    if (parent) {
      const childCount = parent.childIds.length;
      if (childCount >= this.config.maxChildren) {
        throw new Error(`Max children limit reached (${this.config.maxChildren})`);
      }
    }

    // Check generation depth
    const parentGeneration = parent?.generation ?? 0;
    if (parentGeneration >= this.config.maxGenerationDepth) {
      throw new Error(`Max generation depth reached (${this.config.maxGenerationDepth})`);
    }

    // Check minimum funding
    const fundCents = req.fundCents ?? this.config.minSpawnFundCents;
    if (fundCents < this.config.minSpawnFundCents) {
      throw new Error(`Insufficient spawn funds: ${fundCents}¢ < ${this.config.minSpawnFundCents}¢`);
    }

    const id = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const agent: ChildAgent = {
      id,
      name: req.name,
      state: 'spawning',
      task: req.task,
      parentId,
      childIds: [],
      fundedCents: fundCents,
      genesisPrompt: req.genesisPrompt,
      createdAt: new Date().toISOString(),
      lastHeartbeat: Date.now(),
      generation: parentGeneration + 1,
    };

    this.agents.set(id, agent);

    // Register as parent's child
    if (parent) {
      parent.childIds.push(id);
    }

    // Transition to running
    agent.state = 'running';
    this.emit('spawn', { agentId: id, name: req.name, parentId });

    return agent;
  }

  /**
   * Pause a child agent
   */
  pause(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent || agent.state !== 'running') return false;
    agent.state = 'paused';
    return true;
  }

  /**
   * Resume a paused agent
   */
  resume(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent || agent.state !== 'paused') return false;
    agent.state = 'running';
    return true;
  }

  /**
   * Terminate a child agent (and optionally cascade to its children)
   */
  async terminate(id: string, cascade = true): Promise<void> {
    const agent = this.agents.get(id);
    if (!agent) return;

    if (cascade) {
      for (const childId of [...agent.childIds]) {
        await this.terminate(childId, true);
      }
    }

    agent.state = 'terminated';
    this.emit('terminate', { agentId: id, name: agent.name });

    // Notify parent
    if (agent.parentId) {
      this.send({
        from: id,
        to: agent.parentId,
        type: 'death_notice',
        payload: { reason: 'terminated', name: agent.name },
        timestamp: Date.now(),
        id: `msg_${++this.msgIdCounter}`,
        read: false,
      });
    }
  }

  // ── Messaging ──────────────────────────────────────────────────────

  /**
   * Send a message between agents
   */
  send(msg: AgentMessage): void {
    if (!msg.id) msg.id = `msg_${++this.msgIdCounter}`;
    this.inbox.push(msg);
    this.emit('message', msg);
  }

  /**
   * Send a message from parent to child (convenience)
   */
  sendToChild(parentId: string, childId: string, payload: unknown): void {
    this.send({
      id: `msg_${++this.msgIdCounter}`,
      from: parentId,
      to: childId,
      type: 'command',
      payload,
      timestamp: Date.now(),
      read: false,
    });
  }

  /**
   * Get unread messages for an agent
   */
  receive(agentId: string): AgentMessage[] {
    return this.inbox.filter(m => m.to === agentId && !m.read);
  }

  /**
   * Mark messages as read
   */
  markRead(agentId: string): void {
    for (const msg of this.inbox) {
      if (msg.to === agentId) msg.read = true;
    }
  }

  // ── Queries ────────────────────────────────────────────────────────

  get(id: string): ChildAgent | undefined {
    return this.agents.get(id);
  }

  list(): ChildAgent[] {
    return Array.from(this.agents.values());
  }

  listByState(state: ChildState): ChildAgent[] {
    return this.list().filter(a => a.state === state);
  }

  children(parentId: string): ChildAgent[] {
    const parent = this.agents.get(parentId);
    if (!parent) return [];
    return parent.childIds.map(id => this.agents.get(id)!).filter(Boolean);
  }

  /**
   * Build lineage tree from a root agent
   */
  lineage(rootId?: string): LineageNode | null {
    const id = rootId ?? this.config.rootAgentId;
    const agent = this.agents.get(id);
    if (!agent) return null;

    const build = (a: ChildAgent): LineageNode => ({
      id: a.id,
      name: a.name,
      state: a.state,
      generation: a.generation,
      children: a.childIds
        .map(cid => this.agents.get(cid))
        .filter((c): c is ChildAgent => !!c)
        .map(build),
    });

    return build(agent);
  }

  stats(): MultiAgentStats {
    const all = this.list();
    const maxDepth = all.reduce((max, a) => Math.max(max, a.generation), 0);
    return {
      total: all.length,
      running: all.filter(a => a.state === 'running').length,
      paused: all.filter(a => a.state === 'paused').length,
      terminated: all.filter(a => a.state === 'terminated').length,
      dead: all.filter(a => a.state === 'dead').length,
      maxDepth,
    };
  }

  // ── Health Monitoring ──────────────────────────────────────────────

  /**
   * Record a heartbeat from a child
   */
  heartbeat(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) agent.lastHeartbeat = Date.now();
  }

  /**
   * Start health monitoring (check for timed-out agents)
   */
  startHealthMonitor(): void {
    if (this.healthTimer) return;
    this.healthTimer = setInterval(() => {
      const now = Date.now();
      for (const agent of this.agents.values()) {
        if (agent.state === 'running' && now - agent.lastHeartbeat > this.config.heartbeatTimeoutMs) {
          agent.state = 'dead';
          this.emit('heartbeat_timeout', { agentId: agent.id, name: agent.name });
        }
      }
    }, 30_000);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitor(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  // ── Events ─────────────────────────────────────────────────────────

  on(listener: MultiAgentListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(type: MultiAgentEventType, data: unknown): void {
    for (const fn of this.listeners) fn(type, data);
  }

  // ── Cleanup ────────────────────────────────────────────────────────

  destroy(): void {
    this.stopHealthMonitor();
    this.listeners.clear();
    this.agents.clear();
    this.inbox = [];
  }
}
