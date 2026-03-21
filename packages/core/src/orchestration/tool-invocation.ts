/**
 * Round 20.1 — ToolInvocation
 *
 * First-class runtime primitive for tool calls.
 * Sits alongside ChildSession in SessionRegistry, enabling
 * unified observability for both session-bound and independent
 * tool invocations (system/operator/governance origin).
 */

// ── Types ───────────────────────────────────────────────────────────

export type ToolInvocationStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ToolInvocationOrigin = 'session' | 'system' | 'operator' | 'governance';

export type ToolRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ToolManifest {
  readonly name: string;
  readonly description: string;
}

export interface ToolResultEnvelope {
  readonly success: boolean;
  readonly output?: string;
  readonly error?: string;
}

export interface ToolAuditTrace {
  readonly startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

export interface ToolInvocationConfig {
  /** Tool name */
  toolName: string;
  /** Tool manifest */
  toolManifest: ToolManifest;
  /** Who triggered this invocation */
  origin: ToolInvocationOrigin;
  /** Risk level */
  riskLevel: ToolRiskLevel;
  /** Parent session (optional — links to ChildSession) */
  parentSessionId?: string;
}

// ── ToolInvocation ──────────────────────────────────────────────────

export class ToolInvocation {
  readonly id: string;
  readonly toolName: string;
  readonly toolManifest: ToolManifest;
  readonly origin: ToolInvocationOrigin;
  readonly riskLevel: ToolRiskLevel;
  readonly parentSessionId?: string;

  private _status: ToolInvocationStatus = 'pending';
  private _resultEnvelope?: ToolResultEnvelope;
  private _auditTrace: ToolAuditTrace;

  constructor(config: ToolInvocationConfig) {
    this.id = `tinv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.toolName = config.toolName;
    this.toolManifest = config.toolManifest;
    this.origin = config.origin;
    this.riskLevel = config.riskLevel;
    this.parentSessionId = config.parentSessionId;
    this._auditTrace = {
      startedAt: new Date().toISOString(),
    };
  }

  // ── Getters ─────────────────────────────────────────────────────

  get status(): ToolInvocationStatus { return this._status; }
  get resultEnvelope(): ToolResultEnvelope | undefined { return this._resultEnvelope; }
  get auditTrace(): ToolAuditTrace { return { ...this._auditTrace }; }

  // ── Lifecycle ───────────────────────────────────────────────────

  start(): this {
    if (this._status !== 'pending') {
      throw new Error(`Cannot start invocation in status: ${this._status}`);
    }
    this._status = 'running';
    this._auditTrace = {
      startedAt: new Date().toISOString(),
    };
    return this;
  }

  complete(result: { output?: string } = {}): this {
    if (this._status !== 'running') {
      throw new Error(`Cannot complete invocation in status: ${this._status}`);
    }
    this._status = 'completed';
    this._resultEnvelope = { success: true, output: result.output };
    const now = new Date();
    this._auditTrace.completedAt = now.toISOString();
    this._auditTrace.durationMs = now.getTime() - new Date(this._auditTrace.startedAt).getTime();
    return this;
  }

  fail(error: string): this {
    if (this._status !== 'running' && this._status !== 'pending') {
      throw new Error(`Cannot fail invocation in status: ${this._status}`);
    }
    this._status = 'failed';
    this._resultEnvelope = { success: false, error };
    const now = new Date();
    this._auditTrace.completedAt = now.toISOString();
    this._auditTrace.durationMs = now.getTime() - new Date(this._auditTrace.startedAt).getTime();
    return this;
  }

  // ── Serialization ───────────────────────────────────────────────

  toJSON() {
    return {
      id: this.id,
      toolName: this.toolName,
      toolManifest: this.toolManifest,
      origin: this.origin,
      riskLevel: this.riskLevel,
      parentSessionId: this.parentSessionId,
      status: this._status,
      resultEnvelope: this._resultEnvelope,
      auditTrace: this._auditTrace,
    };
  }
}

/**
 * Factory function for creating tool invocations.
 */
export function createToolInvocation(config: ToolInvocationConfig): ToolInvocation {
  return new ToolInvocation(config);
}
