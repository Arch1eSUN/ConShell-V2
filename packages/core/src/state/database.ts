/**
 * SQLite connection manager — WAL mode, migrations, integrity checks.
 *
 * Manages the database lifecycle: opens in WAL mode with foreign keys,
 * runs migrations on init, and provides an in-memory option for tests.
 */
import Database from 'better-sqlite3';
import { join } from 'node:path';
import type { Logger } from '../types/common.js';

// ── Constants ──────────────────────────────────────────────────────────

export const DB_FILENAME = 'state.db';

// ── Errors ─────────────────────────────────────────────────────────────

export class DatabaseCorruptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseCorruptionError';
  }
}

export class MigrationError extends Error {
  readonly version: number;
  readonly cause: Error;

  constructor(version: number, cause: Error) {
    super(`Migration v${version} failed: ${cause.message}`);
    this.name = 'MigrationError';
    this.version = version;
    this.cause = cause;
  }
}

// ── Migration Interface ────────────────────────────────────────────────

export interface Migration {
  readonly version: number;
  readonly description: string;
  apply(db: Database.Database): void;
}

// ── Options ────────────────────────────────────────────────────────────

export interface DatabaseOptions {
  /** Path to the agent home directory containing state.db */
  readonly agentHome: string;
  /** Logger instance */
  readonly logger: Logger;
  /** Optional: override full db path (for testing) */
  readonly dbPath?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────

/** ISO-8601 UTC timestamp for SQL storage */
export function nowISO(): string {
  return new Date().toISOString();
}

// ── Migration Runner ───────────────────────────────────────────────────

function getCurrentVersion(db: Database.Database): number {
  const tableExists = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='schema_version'",
    )
    .get() as { cnt: number };

  if (tableExists.cnt === 0) return 0;

  const row = db
    .prepare('SELECT MAX(version) as version FROM schema_version')
    .get() as { version: number | null } | undefined;

  return row?.version ?? 0;
}

function runMigrations(
  db: Database.Database,
  migrations: readonly Migration[],
  logger: Logger,
): void {
  const currentVersion = getCurrentVersion(db);
  const pending = migrations.filter((m) => m.version > currentVersion);

  if (pending.length === 0) {
    logger.debug('No pending migrations', { currentVersion });
    return;
  }

  logger.info('Running migrations', {
    currentVersion,
    pendingCount: pending.length,
    targetVersion: pending[pending.length - 1]!.version,
  });

  for (const migration of pending) {
    const applyOne = db.transaction(() => {
      try {
        migration.apply(db);
        db.prepare(
          'INSERT INTO schema_version (version, applied_at) VALUES (?, ?)',
        ).run(migration.version, nowISO());
        logger.info('Applied migration', {
          version: migration.version,
          description: migration.description,
        });
      } catch (err) {
        throw new MigrationError(
          migration.version,
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    });
    applyOne();
  }
}

// ── Migration Definitions ──────────────────────────────────────────────

export const MIGRATIONS: readonly Migration[] = [
  // v1: Core tables
  {
    version: 1,
    description: 'Core tables: schema_version, identity, turns, tool_calls, transactions, kv',
    apply(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version    INTEGER PRIMARY KEY,
          applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS identity (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS turns (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id      TEXT    NOT NULL,
          role            TEXT    NOT NULL DEFAULT 'assistant',
          content         TEXT,
          thinking        TEXT,
          tool_calls_json TEXT,
          input_tokens    INTEGER NOT NULL DEFAULT 0,
          output_tokens   INTEGER NOT NULL DEFAULT 0,
          cost_cents      INTEGER NOT NULL DEFAULT 0,
          model           TEXT,
          created_at      TEXT    NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id);
        CREATE INDEX IF NOT EXISTS idx_turns_created ON turns(created_at);

        CREATE TABLE IF NOT EXISTS tool_calls (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          turn_id     INTEGER NOT NULL REFERENCES turns(id),
          name        TEXT    NOT NULL,
          args_json   TEXT,
          result      TEXT,
          duration_ms INTEGER NOT NULL DEFAULT 0,
          source      TEXT    NOT NULL DEFAULT 'agent',
          created_at  TEXT    NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tool_calls_turn ON tool_calls(turn_id);
        CREATE INDEX IF NOT EXISTS idx_tool_calls_name ON tool_calls(name);

        CREATE TABLE IF NOT EXISTS transactions (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          type         TEXT    NOT NULL,
          amount_cents INTEGER NOT NULL,
          from_address TEXT,
          to_address   TEXT,
          network      TEXT,
          status       TEXT    NOT NULL DEFAULT 'pending',
          tx_hash      TEXT,
          created_at   TEXT    NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

        CREATE TABLE IF NOT EXISTS kv (
          key        TEXT PRIMARY KEY,
          value      TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
    },
  },

  // v2: Heartbeat + Policy + Spend
  {
    version: 2,
    description: 'Heartbeat schedule/history/dedup, wake events, policy decisions, spend tracking',
    apply(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS heartbeat_schedule (
          name          TEXT PRIMARY KEY,
          cron          TEXT NOT NULL,
          enabled       INTEGER NOT NULL DEFAULT 1,
          min_tier      TEXT NOT NULL DEFAULT 'critical',
          last_run      TEXT,
          lease_holder  TEXT,
          lease_expires TEXT,
          config_json   TEXT
        );

        CREATE TABLE IF NOT EXISTS heartbeat_history (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          task_name   TEXT NOT NULL,
          result      TEXT NOT NULL,
          duration_ms INTEGER NOT NULL DEFAULT 0,
          error       TEXT,
          should_wake INTEGER NOT NULL DEFAULT 0,
          created_at  TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_hb_history_task ON heartbeat_history(task_name);

        CREATE TABLE IF NOT EXISTS heartbeat_dedup (
          key        TEXT PRIMARY KEY,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS wake_events (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          source     TEXT NOT NULL,
          reason     TEXT NOT NULL,
          consumed   INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_wake_consumed ON wake_events(consumed, created_at);

        CREATE TABLE IF NOT EXISTS policy_decisions (
          id                 INTEGER PRIMARY KEY AUTOINCREMENT,
          tool_name          TEXT NOT NULL,
          tool_args_redacted TEXT,
          source             TEXT NOT NULL,
          allowed            INTEGER NOT NULL,
          rule_category      TEXT,
          rule_name          TEXT,
          reason             TEXT,
          created_at         TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_policy_tool ON policy_decisions(tool_name);

        CREATE TABLE IF NOT EXISTS spend_tracking (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          type         TEXT    NOT NULL,
          amount_cents INTEGER NOT NULL,
          window_hour  TEXT    NOT NULL,
          window_day   TEXT    NOT NULL,
          created_at   TEXT    NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_spend_hour ON spend_tracking(window_hour);
      `);
    },
  },

  // v3: Memory (5-tier) + Soul history
  {
    version: 3,
    description: 'Memory subsystem: working, episodic, session_summaries, semantic, procedural, relationship; soul history',
    apply(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS working_memory (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          type       TEXT NOT NULL,
          content    TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_wm_session ON working_memory(session_id);

        CREATE TABLE IF NOT EXISTS episodic_memory (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type     TEXT    NOT NULL,
          content        TEXT    NOT NULL,
          importance     INTEGER NOT NULL DEFAULT 5,
          classification TEXT,
          session_id     TEXT,
          turn_id        INTEGER,
          created_at     TEXT    NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_ep_importance ON episodic_memory(importance DESC, created_at);

        CREATE TABLE IF NOT EXISTS session_summaries (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL UNIQUE,
          summary    TEXT NOT NULL,
          outcome    TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS semantic_memory (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          category   TEXT    NOT NULL,
          key        TEXT    NOT NULL,
          value      TEXT    NOT NULL,
          confidence INTEGER NOT NULL DEFAULT 5,
          source     TEXT,
          created_at TEXT    NOT NULL,
          updated_at TEXT    NOT NULL,
          UNIQUE(category, key)
        );
        CREATE INDEX IF NOT EXISTS idx_sem_cat ON semantic_memory(category, key);

        CREATE TABLE IF NOT EXISTS procedural_memory (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          name          TEXT    NOT NULL UNIQUE,
          steps_json    TEXT    NOT NULL,
          success_count INTEGER NOT NULL DEFAULT 0,
          failure_count INTEGER NOT NULL DEFAULT 0,
          last_used     TEXT,
          created_at    TEXT    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS relationship_memory (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_id         TEXT    NOT NULL UNIQUE,
          entity_type       TEXT    NOT NULL,
          trust_score       INTEGER NOT NULL DEFAULT 50,
          interaction_count INTEGER NOT NULL DEFAULT 0,
          last_interaction  TEXT,
          notes             TEXT,
          created_at        TEXT    NOT NULL,
          updated_at        TEXT    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS soul_history (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          content         TEXT NOT NULL,
          content_hash    TEXT NOT NULL,
          alignment_score REAL,
          created_at      TEXT NOT NULL
        );
      `);
    },
  },

  // v4: Model registry + Inference costs + Skills + Provider config
  {
    version: 4,
    description: 'Model registry, inference costs, skills, provider config, routing config',
    apply(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS model_registry (
          id                TEXT PRIMARY KEY,
          provider          TEXT    NOT NULL,
          name              TEXT    NOT NULL,
          input_cost_micro  INTEGER NOT NULL DEFAULT 0,
          output_cost_micro INTEGER NOT NULL DEFAULT 0,
          max_tokens        INTEGER NOT NULL DEFAULT 4096,
          capabilities_json TEXT,
          available         INTEGER NOT NULL DEFAULT 1,
          updated_at        TEXT    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS inference_costs (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          model         TEXT    NOT NULL,
          provider      TEXT    NOT NULL,
          input_tokens  INTEGER NOT NULL,
          output_tokens INTEGER NOT NULL,
          cost_cents    INTEGER NOT NULL,
          latency_ms    INTEGER NOT NULL DEFAULT 0,
          task_type     TEXT,
          created_at    TEXT    NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_inf_model ON inference_costs(model);
        CREATE INDEX IF NOT EXISTS idx_inf_created ON inference_costs(created_at);

        CREATE TABLE IF NOT EXISTS skills (
          name          TEXT PRIMARY KEY,
          description   TEXT,
          triggers_json TEXT,
          content       TEXT NOT NULL,
          source        TEXT NOT NULL DEFAULT 'local',
          enabled       INTEGER NOT NULL DEFAULT 1,
          installed_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS provider_config (
          name       TEXT PRIMARY KEY,
          auth_type  TEXT NOT NULL,
          endpoint   TEXT,
          api_key    TEXT,
          enabled    INTEGER NOT NULL DEFAULT 1,
          priority   INTEGER NOT NULL DEFAULT 100,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS routing_config (
          id        INTEGER PRIMARY KEY AUTOINCREMENT,
          tier      TEXT NOT NULL,
          task_type TEXT NOT NULL,
          model_id  TEXT NOT NULL,
          priority  INTEGER NOT NULL DEFAULT 0,
          UNIQUE(tier, task_type, model_id)
        );
      `);
    },
  },

  // v5: Sessions table for persistent conversation state
  {
    version: 5,
    description: 'Sessions table: conversation metadata for persistent state',
    apply(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id         TEXT PRIMARY KEY,
          title      TEXT,
          channel    TEXT NOT NULL DEFAULT 'webchat',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_sessions_channel ON sessions(channel);
      `);
    },
  },
  // v6: Identity Anchor + Continuity Records + Memory-Identity Binding
  {
    version: 6,
    description: 'Identity anchor, continuity records (hash-chained), owner_id on memory tables',
    apply(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS identity_anchor (
          id             TEXT PRIMARY KEY,
          name           TEXT NOT NULL,
          wallet_address TEXT,
          soul_hash      TEXT NOT NULL,
          created_at     TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS continuity_records (
          version              INTEGER PRIMARY KEY,
          identity_id          TEXT NOT NULL REFERENCES identity_anchor(id),
          soul_hash            TEXT NOT NULL,
          soul_version         INTEGER NOT NULL DEFAULT 0,
          session_count        INTEGER NOT NULL DEFAULT 0,
          memory_episode_count INTEGER NOT NULL DEFAULT 0,
          last_session_id      TEXT,
          previous_hash        TEXT,
          record_hash          TEXT NOT NULL,
          created_at           TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_cr_identity ON continuity_records(identity_id);
      `);
      // Add owner_id to memory tables (nullable, non-breaking)
      // Use try/catch for each ALTER — column may already exist on re-run
      const alterStatements = [
        'ALTER TABLE episodic_memory ADD COLUMN owner_id TEXT',
        'ALTER TABLE soul_history ADD COLUMN owner_id TEXT',
        'ALTER TABLE session_summaries ADD COLUMN owner_id TEXT',
      ];
      for (const stmt of alterStatements) {
        try { db.exec(stmt); } catch { /* column already exists — safe to ignore */ }
      }
    },
  },
  // v7: Lineage pre-embedding (Round 14.5)
  {
    version: 7,
    description: 'Add lineage fields to identity_anchor for future child/replication support',
    apply(db) {
      const alterStatements = [
        'ALTER TABLE identity_anchor ADD COLUMN parent_identity_id TEXT DEFAULT NULL',
        'ALTER TABLE identity_anchor ADD COLUMN generation INTEGER DEFAULT 0',
      ];
      for (const stmt of alterStatements) {
        try { db.exec(stmt); } catch { /* column already exists — safe to ignore */ }
      }
    },
  },
  // v8: Durable Agent Card Registry (Phase 2 — P2-1)
  {
    version: 8,
    description: 'Persistent agent card registry (replaces InMemoryAgentRegistry)',
    apply(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS agent_cards (
          id             TEXT PRIMARY KEY,
          name           TEXT NOT NULL UNIQUE,
          version        TEXT NOT NULL,
          description    TEXT NOT NULL DEFAULT '',
          wallet_address TEXT,
          chain_id       INTEGER,
          token_id       TEXT,
          services_json  TEXT NOT NULL DEFAULT '[]',
          nonce          TEXT NOT NULL,
          created_at     TEXT NOT NULL,
          signature      TEXT,
          public_key     TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_agent_cards_name ON agent_cards(LOWER(name));
      `);
    },
  },
  // v9: Spend Attribution — session_id, turn_id, kind, provider, model (Round 15.3)
  {
    version: 9,
    description: 'Extend spend_tracking with attribution columns for economic grounding',
    apply(db) {
      const alterStatements = [
        'ALTER TABLE spend_tracking ADD COLUMN session_id TEXT DEFAULT NULL',
        'ALTER TABLE spend_tracking ADD COLUMN turn_id TEXT DEFAULT NULL',
        'ALTER TABLE spend_tracking ADD COLUMN kind TEXT DEFAULT \'inference\'',
        'ALTER TABLE spend_tracking ADD COLUMN provider TEXT DEFAULT NULL',
        'ALTER TABLE spend_tracking ADD COLUMN model TEXT DEFAULT NULL',
      ];
      for (const stmt of alterStatements) {
        try { db.exec(stmt); } catch { /* column already exists — safe to ignore */ }
      }
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_spend_session ON spend_tracking(session_id);
        CREATE INDEX IF NOT EXISTS idx_spend_turn ON spend_tracking(turn_id);
        CREATE INDEX IF NOT EXISTS idx_spend_kind ON spend_tracking(kind);
      `);
    },
  },
  // v10: Commitments table (Round 16.1 — Autonomous Agenda)
  {
    version: 10,
    description: 'Commitments table for durable agenda and commitment runtime',
    apply(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS commitments (
          id                   TEXT PRIMARY KEY,
          name                 TEXT NOT NULL,
          description          TEXT,
          kind                 TEXT NOT NULL,
          origin               TEXT NOT NULL,
          status               TEXT NOT NULL DEFAULT 'planned',
          priority             TEXT NOT NULL DEFAULT 'normal',
          due_at               TEXT,
          last_evaluated_at    TEXT,
          next_review_at       TEXT,
          expected_value_cents INTEGER NOT NULL DEFAULT 0,
          estimated_cost_cents INTEGER NOT NULL DEFAULT 0,
          must_preserve        INTEGER NOT NULL DEFAULT 0,
          revenue_bearing      INTEGER NOT NULL DEFAULT 0,
          task_type            TEXT NOT NULL DEFAULT 'general',
          blocked_reason       TEXT,
          failed_reason        TEXT,
          materialized_tasks   INTEGER NOT NULL DEFAULT 0,
          created_at           TEXT NOT NULL,
          updated_at           TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_commitments_status ON commitments(status);
        CREATE INDEX IF NOT EXISTS idx_commitments_due ON commitments(due_at);
        CREATE INDEX IF NOT EXISTS idx_commitments_review ON commitments(next_review_at);
      `);
    },
  },
];

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Open (or create) the agent database and run pending migrations.
 *
 * - WAL mode for concurrent reads
 * - Foreign keys enforced
 * - Synchronous NORMAL for durability/performance balance
 */
export function openDatabase(options: DatabaseOptions): Database.Database {
  const { logger } = options;
  const dbPath = options.dbPath ?? join(options.agentHome, DB_FILENAME);
  const log = logger.child('sqlite-state');

  log.info('Opening database', { path: dbPath });

  const db = new Database(dbPath);

  // Enable WAL mode for concurrent read access
  db.pragma('journal_mode = WAL');
  // Enforce foreign key constraints
  db.pragma('foreign_keys = ON');
  // NORMAL synchronous: good perf with acceptable crash safety
  db.pragma('synchronous = NORMAL');
  // Busy timeout: wait up to 5 seconds for locks
  db.pragma('busy_timeout = 5000');

  // Verify integrity on first open
  const integrityCheck = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
  if (integrityCheck.length !== 1 || integrityCheck[0]?.integrity_check !== 'ok') {
    throw new DatabaseCorruptionError(
      `Integrity check failed: ${JSON.stringify(integrityCheck)}`,
    );
  }

  // Run pending migrations
  runMigrations(db, MIGRATIONS, log);

  log.info('Database ready');
  return db;
}

/**
 * Open an in-memory database for testing with migrations applied.
 */
export function openTestDatabase(logger: Logger): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db, MIGRATIONS, logger.child('sqlite-test'));
  return db;
}
