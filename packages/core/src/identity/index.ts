/**
 * Identity — Agent身份卡 + SIWE + 注册表 (完整版)
 *
 * 功能:
 * - Agent Card 创建与验证
 * - SIWE (EIP-4361) 身份验证
 * - 链上身份注册 (via ERC-8004)
 * - Agent 发现服务
 */
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { createSiweMessage, signSiweMessage, generateNonce, type SiweMessage } from '../wallet/index.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface AgentService {
  type: string;
  endpoint: string;
  description?: string;
  capabilities?: string[];
}

export interface AgentCard {
  /** Unique agent ID */
  id: string;
  /** Agent name */
  name: string;
  /** Version */
  version: string;
  /** Description */
  description: string;
  /** Wallet address */
  walletAddress?: `0x${string}`;
  /** Chain ID */
  chainId?: number;
  /** ERC-8004 Token ID */
  tokenId?: string;
  /** Services offered */
  services: AgentService[];
  /** Cryptographic nonce */
  nonce: string;
  /** Creation timestamp */
  timestamp: string;
  /** Card signature (SIWE) */
  signature?: string;
  /** Public key */
  publicKey?: string;
}

export interface AgentCardValidation {
  valid: boolean;
  errors: string[];
}

export interface AgentRegistry {
  /** Register an agent */
  register(card: AgentCard): Promise<void>;
  /** Lookup an agent by name */
  lookup(name: string): Promise<AgentCard | null>;
  /** Search agents by service type */
  searchByService(serviceType: string): Promise<AgentCard[]>;
  /** List all registered agents */
  listAll(): Promise<AgentCard[]>;
}

// ── Agent Card ─────────────────────────────────────────────────────────

/**
 * Create a new Agent Card
 */
export function createAgentCard(params: {
  name: string;
  version?: string;
  description?: string;
  walletAddress?: `0x${string}`;
  chainId?: number;
  services?: AgentService[];
}): AgentCard {
  return {
    id: randomUUID(),
    name: params.name,
    version: params.version ?? '1.0.0',
    description: params.description ?? `Agent: ${params.name}`,
    walletAddress: params.walletAddress,
    chainId: params.chainId,
    services: params.services ?? [],
    nonce: randomBytes(16).toString('hex'),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Sign an Agent Card using SIWE
 */
export function signAgentCard(
  card: AgentCard,
  privateKey: string,
  domain: string,
): AgentCard {
  if (!card.walletAddress) {
    throw new Error('Cannot sign card without wallet address');
  }

  const siweMessage = createSiweMessage({
    domain,
    address: card.walletAddress,
    statement: `Agent Card: ${card.name} v${card.version}`,
    uri: `https://${domain}/agents/${card.id}`,
    version: '1',
    chainId: card.chainId ?? 8453,
    nonce: card.nonce,
    issuedAt: card.timestamp,
  });

  const signature = signSiweMessage(siweMessage, privateKey);

  return { ...card, signature };
}

/**
 * Validate an Agent Card
 */
export function validateAgentCard(card: AgentCard): AgentCardValidation {
  const errors: string[] = [];

  if (!card.name || card.name.length < 2) {
    errors.push('Name must be at least 2 characters');
  }
  if (!card.version) {
    errors.push('Version is required');
  }
  if (!card.nonce || card.nonce.length < 16) {
    errors.push('Nonce must be at least 16 characters');
  }
  if (!card.timestamp) {
    errors.push('Timestamp is required');
  }
  if (card.walletAddress && !card.walletAddress.startsWith('0x')) {
    errors.push('Wallet address must start with 0x');
  }
  for (const svc of card.services) {
    if (!svc.type) errors.push('Service type is required');
    if (!svc.endpoint) errors.push('Service endpoint is required');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Compute fingerprint of an agent card
 */
export function cardFingerprint(card: AgentCard): string {
  const canonical = JSON.stringify({
    name: card.name,
    version: card.version,
    walletAddress: card.walletAddress,
    services: card.services,
    nonce: card.nonce,
    timestamp: card.timestamp,
  });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

// ── In-Memory Agent Registry ───────────────────────────────────────────

export class InMemoryAgentRegistry implements AgentRegistry {
  private agents = new Map<string, AgentCard>();

  async register(card: AgentCard): Promise<void> {
    const validation = validateAgentCard(card);
    if (!validation.valid) {
      throw new Error(`Invalid agent card: ${validation.errors.join(', ')}`);
    }
    this.agents.set(card.name.toLowerCase(), card);
  }

  async lookup(name: string): Promise<AgentCard | null> {
    return this.agents.get(name.toLowerCase()) ?? null;
  }

  async searchByService(serviceType: string): Promise<AgentCard[]> {
    const results: AgentCard[] = [];
    for (const card of this.agents.values()) {
      if (card.services.some(s => s.type === serviceType)) {
        results.push(card);
      }
    }
    return results;
  }

  async listAll(): Promise<AgentCard[]> {
    return Array.from(this.agents.values());
  }
}

// ── SIWE Authentication Helper ─────────────────────────────────────────

/**
 * Create and sign a SIWE authentication message
 */
export function createSiweAuth(params: {
  domain: string;
  address: `0x${string}`;
  statement?: string;
  chainId?: number;
  privateKey: string;
}): { message: string; signature: string } {
  const siwe: SiweMessage = {
    domain: params.domain,
    address: params.address,
    statement: params.statement ?? 'Sign in to ConShell',
    uri: `https://${params.domain}`,
    version: '1',
    chainId: params.chainId ?? 8453,
    nonce: generateNonce(),
    issuedAt: new Date().toISOString(),
  };

  const message = createSiweMessage(siwe);
  const signature = signSiweMessage(message, params.privateKey);

  return { message, signature };
}
