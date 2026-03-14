/**
 * PersistentAgentRegistry — SQLite-backed AgentCard persistence.
 *
 * Replaces InMemoryAgentRegistry for production use.
 * Survives restarts, supports CRUD + search by service type.
 *
 * ## Identity Contract (Round 15.0.2)
 *
 * `name` is the canonical business identity key. `id` is a client-generated
 * unique identifier carried for external reference.
 *
 * **UPSERT on name collision**: when `register(card)` is called with a `name`
 * that already exists in the registry, the existing record is **overwritten**
 * (including its `id`). This models agent version upgrades — the same logical
 * agent evolves its capabilities without creating duplicate entries.
 *
 * **Different names with same id**: this is allowed and produces two separate
 * entries. The registry does not enforce id uniqueness — only name uniqueness.
 */
import type Database from 'better-sqlite3';
import { validateAgentCard, type AgentCard, type AgentService, type AgentRegistry } from './index.js';

// ── Row type ──────────────────────────────────────────────────────────

interface AgentCardRow {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly wallet_address: string | null;
  readonly chain_id: number | null;
  readonly token_id: string | null;
  readonly services_json: string;
  readonly nonce: string;
  readonly created_at: string;
  readonly signature: string | null;
  readonly public_key: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────

function rowToCard(row: AgentCardRow): AgentCard {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    description: row.description,
    walletAddress: row.wallet_address as `0x${string}` | undefined,
    chainId: row.chain_id ?? undefined,
    tokenId: row.token_id ?? undefined,
    services: JSON.parse(row.services_json) as AgentService[],
    nonce: row.nonce,
    timestamp: row.created_at,
    signature: row.signature ?? undefined,
    publicKey: row.public_key ?? undefined,
  };
}

// ── PersistentAgentRegistry ────────────────────────────────────────────

export class PersistentAgentRegistry implements AgentRegistry {
  private readonly upsertStmt: Database.Statement;
  private readonly lookupStmt: Database.Statement;
  private readonly listAllStmt: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.upsertStmt = db.prepare(`
      INSERT INTO agent_cards (id, name, version, description, wallet_address, chain_id, token_id, services_json, nonce, created_at, signature, public_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        version = excluded.version,
        description = excluded.description,
        wallet_address = excluded.wallet_address,
        chain_id = excluded.chain_id,
        token_id = excluded.token_id,
        services_json = excluded.services_json,
        nonce = excluded.nonce,
        created_at = excluded.created_at,
        signature = excluded.signature,
        public_key = excluded.public_key
    `);

    this.lookupStmt = db.prepare(
      'SELECT * FROM agent_cards WHERE LOWER(name) = LOWER(?)',
    );

    this.listAllStmt = db.prepare(
      'SELECT * FROM agent_cards ORDER BY name ASC',
    );
  }

  async register(card: AgentCard): Promise<void> {
    const validation = validateAgentCard(card);
    if (!validation.valid) {
      throw new Error(`Invalid agent card: ${validation.errors.join(', ')}`);
    }
    this.upsertStmt.run(
      card.id,
      card.name,
      card.version,
      card.description,
      card.walletAddress ?? null,
      card.chainId ?? null,
      card.tokenId ?? null,
      JSON.stringify(card.services),
      card.nonce,
      card.timestamp,
      card.signature ?? null,
      card.publicKey ?? null,
    );
  }

  async lookup(name: string): Promise<AgentCard | null> {
    const row = this.lookupStmt.get(name) as AgentCardRow | undefined;
    return row ? rowToCard(row) : null;
  }

  async searchByService(serviceType: string): Promise<AgentCard[]> {
    // Parse services JSON in-app for flexibility (no SQLite JSON extension required)
    const all = await this.listAll();
    return all.filter(card => card.services.some(s => s.type === serviceType));
  }

  async listAll(): Promise<AgentCard[]> {
    const rows = this.listAllStmt.all() as AgentCardRow[];
    return rows.map(rowToCard);
  }
}
