/**
 * Model registry + inference costs repositories.
 */
import type Database from 'better-sqlite3';
import type { Cents } from '../../types/common.js';
import { nowISO } from '../database.js';

// ── Model Registry ─────────────────────────────────────────────────────

export interface ModelRegistryRow {
  readonly id: string;
  readonly provider: string;
  readonly name: string;
  readonly input_cost_micro: number;
  readonly output_cost_micro: number;
  readonly max_tokens: number;
  readonly capabilities_json: string | null;
  readonly available: number;
  readonly updated_at: string;
}

export interface UpsertModel {
  readonly id: string;
  readonly provider: string;
  readonly name: string;
  readonly inputCostMicro?: number;
  readonly outputCostMicro?: number;
  readonly maxTokens?: number;
  readonly capabilitiesJson?: string;
  readonly available?: boolean;
}

export class ModelRegistryRepository {
  private readonly upsertStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly findByProviderStmt: Database.Statement;
  private readonly listAvailableStmt: Database.Statement;
  private readonly setAvailableStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.upsertStmt = db.prepare(`
      INSERT INTO model_registry (id, provider, name, input_cost_micro, output_cost_micro, max_tokens, capabilities_json, available, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        provider = excluded.provider, name = excluded.name,
        input_cost_micro = excluded.input_cost_micro, output_cost_micro = excluded.output_cost_micro,
        max_tokens = excluded.max_tokens, capabilities_json = excluded.capabilities_json,
        available = excluded.available, updated_at = excluded.updated_at
    `);
    this.findByIdStmt = db.prepare('SELECT * FROM model_registry WHERE id = ?');
    this.findByProviderStmt = db.prepare('SELECT * FROM model_registry WHERE provider = ? AND available = 1 ORDER BY name');
    this.listAvailableStmt = db.prepare('SELECT * FROM model_registry WHERE available = 1 ORDER BY provider, name');
    this.setAvailableStmt = db.prepare('UPDATE model_registry SET available = ?, updated_at = ? WHERE id = ?');
  }

  upsert(model: UpsertModel): void {
    this.upsertStmt.run(
      model.id, model.provider, model.name,
      model.inputCostMicro ?? 0, model.outputCostMicro ?? 0,
      model.maxTokens ?? 4096, model.capabilitiesJson ?? null,
      model.available !== false ? 1 : 0, nowISO(),
    );
  }

  findById(id: string): ModelRegistryRow | undefined {
    return this.findByIdStmt.get(id) as ModelRegistryRow | undefined;
  }

  findByProvider(provider: string): readonly ModelRegistryRow[] {
    return this.findByProviderStmt.all(provider) as ModelRegistryRow[];
  }

  listAvailable(): readonly ModelRegistryRow[] {
    return this.listAvailableStmt.all() as ModelRegistryRow[];
  }

  setAvailable(id: string, available: boolean): void {
    this.setAvailableStmt.run(available ? 1 : 0, nowISO(), id);
  }
}

// ── Inference Costs ────────────────────────────────────────────────────

export interface InferenceCostRow {
  readonly id: number;
  readonly model: string;
  readonly provider: string;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cost_cents: number;
  readonly latency_ms: number;
  readonly task_type: string | null;
  readonly created_at: string;
}

export interface InsertInferenceCost {
  readonly model: string;
  readonly provider: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costCents: Cents;
  readonly latencyMs: number;
  readonly taskType?: string;
}

export class InferenceCostsRepository {
  private readonly insertStmt: Database.Statement;
  private readonly findByModelStmt: Database.Statement;
  private readonly totalCostStmt: Database.Statement;
  private readonly recentStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO inference_costs (model, provider, input_tokens, output_tokens, cost_cents, latency_ms, task_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.findByModelStmt = db.prepare(
      'SELECT * FROM inference_costs WHERE model = ? ORDER BY created_at DESC LIMIT ?',
    );
    this.totalCostStmt = db.prepare(
      'SELECT COALESCE(SUM(cost_cents), 0) as total FROM inference_costs WHERE created_at >= ?',
    );
    this.recentStmt = db.prepare(
      'SELECT * FROM inference_costs ORDER BY created_at DESC LIMIT ?',
    );
  }

  insert(cost: InsertInferenceCost): number {
    const result = this.insertStmt.run(
      cost.model, cost.provider, cost.inputTokens, cost.outputTokens,
      cost.costCents as number, cost.latencyMs, cost.taskType ?? null, nowISO(),
    );
    return Number(result.lastInsertRowid);
  }

  findByModel(model: string, limit = 50): readonly InferenceCostRow[] {
    return this.findByModelStmt.all(model, limit) as InferenceCostRow[];
  }

  totalCostSince(sinceISO: string): Cents {
    const row = this.totalCostStmt.get(sinceISO) as { total: number };
    return row.total as Cents;
  }

  findRecent(limit = 50): readonly InferenceCostRow[] {
    return this.recentStmt.all(limit) as InferenceCostRow[];
  }
}
