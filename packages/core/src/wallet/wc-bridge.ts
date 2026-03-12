/**
 * WalletConnect Bridge — Agent端WC客户端
 *
 * 使Agent能够:
 *  1. 向用户外部钱包发送签名请求（大额交易审批）
 *  2. 接收签名结果
 *  3. Session持久化（SQLite-backed）
 *
 * 架构:
 *  - Agent作为dApp（请求方）
 *  - 用户手机上的MetaMask/Rainbow作为钱包（签名方）
 *  - 通过WalletConnect relay中继
 *
 * 注意: 实际WalletConnect SDK集成需要 @walletconnect/web3wallet
 *       本模块提供session管理和消息协议框架
 */
import type Database from 'better-sqlite3';
import type { Logger } from '../types/common.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface WCSession {
  readonly id: string;
  readonly peerAddress: `0x${string}`;
  readonly peerChainId: number;
  readonly peerWalletType: string;
  readonly topic: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly active: boolean;
}

export interface SignRequest {
  readonly id: string;
  readonly sessionId: string;
  readonly method: 'personal_sign' | 'eth_signTypedData_v4' | 'eth_sendTransaction';
  readonly params: unknown;
  readonly reason: string;
  readonly createdAt: string;
  readonly status: 'pending' | 'approved' | 'rejected' | 'expired';
  readonly result?: string;
}

export interface WCBridgeConfig {
  readonly projectId: string; // WalletConnect Cloud project ID
  readonly metadata: {
    readonly name: string;
    readonly description: string;
    readonly url: string;
    readonly icons: string[];
  };
  readonly requestTimeoutMs: number;
}

// ── WC Bridge ─────────────────────────────────────────────────────────

export class WalletConnectBridge {
  private readonly db: Database.Database;
  private readonly logger: Logger;
  private readonly config: WCBridgeConfig;
  private sessions = new Map<string, WCSession>();

  constructor(db: Database.Database, config: WCBridgeConfig, logger: Logger) {
    this.db = db;
    this.config = config;
    this.logger = logger.child('wc-bridge');

    this.ensureTable();
    this.loadSessions();
  }

  // ── Session Management ────────────────────────────────────────────

  /**
   * 创建新的WC连接session
   */
  createSession(data: {
    peerAddress: `0x${string}`;
    peerChainId: number;
    peerWalletType: string;
    topic: string;
    expiresInMs?: number;
  }): WCSession {
    const id = `wc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + (data.expiresInMs ?? 24 * 60 * 60 * 1000)).toISOString();

    const session: WCSession = {
      id,
      peerAddress: data.peerAddress,
      peerChainId: data.peerChainId,
      peerWalletType: data.peerWalletType,
      topic: data.topic,
      createdAt: now,
      expiresAt,
      active: true,
    };

    this.db.prepare(`
      INSERT INTO wc_sessions (id, peer_address, peer_chain_id, peer_wallet_type, topic, created_at, expires_at, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(id, data.peerAddress, data.peerChainId, data.peerWalletType, data.topic, now, expiresAt);

    this.sessions.set(id, session);
    this.logger.info('WC session created', { id, peer: data.peerAddress, wallet: data.peerWalletType });

    return session;
  }

  /**
   * 获取活跃sessions
   */
  getActiveSessions(): WCSession[] {
    const now = new Date().toISOString();
    return Array.from(this.sessions.values()).filter(
      s => s.active && s.expiresAt > now,
    );
  }

  /**
   * 关闭session
   */
  closeSession(sessionId: string): void {
    this.db.prepare(`UPDATE wc_sessions SET active = 0 WHERE id = ?`).run(sessionId);
    this.sessions.delete(sessionId);
    this.logger.info('WC session closed', { sessionId });
  }

  // ── Sign Request Management ───────────────────────────────────────

  /**
   * 创建签名请求
   */
  createSignRequest(data: {
    sessionId: string;
    method: SignRequest['method'];
    params: unknown;
    reason: string;
  }): SignRequest {
    const session = this.sessions.get(data.sessionId);
    if (!session || !session.active) {
      throw new Error(`No active session: ${data.sessionId}`);
    }

    const id = `sr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const request: SignRequest = {
      id,
      sessionId: data.sessionId,
      method: data.method,
      params: data.params,
      reason: data.reason,
      createdAt: now,
      status: 'pending',
    };

    this.db.prepare(`
      INSERT INTO wc_sign_requests (id, session_id, method, params_json, reason, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(id, data.sessionId, data.method, JSON.stringify(data.params), data.reason, now);

    this.logger.info('Sign request created', {
      id,
      sessionId: data.sessionId,
      method: data.method,
      reason: data.reason,
    });

    return request;
  }

  /**
   * 更新签名请求状态
   */
  updateSignRequest(requestId: string, status: 'approved' | 'rejected' | 'expired', result?: string): void {
    this.db.prepare(`
      UPDATE wc_sign_requests SET status = ?, result = ? WHERE id = ?
    `).run(status, result ?? null, requestId);

    this.logger.info('Sign request updated', { requestId, status });
  }

  /**
   * 获取待处理签名请求
   */
  getPendingRequests(sessionId?: string): SignRequest[] {
    let query = 'SELECT * FROM wc_sign_requests WHERE status = ?';
    const params: unknown[] = ['pending'];

    if (sessionId) {
      query += ' AND session_id = ?';
      params.push(sessionId);
    }

    const rows = this.db.prepare(query).all(...params) as Array<{
      id: string;
      session_id: string;
      method: string;
      params_json: string;
      reason: string;
      created_at: string;
      status: string;
      result: string | null;
    }>;

    return rows.map(r => ({
      id: r.id,
      sessionId: r.session_id,
      method: r.method as SignRequest['method'],
      params: JSON.parse(r.params_json),
      reason: r.reason,
      createdAt: r.created_at,
      status: r.status as SignRequest['status'],
      result: r.result ?? undefined,
    }));
  }

  /**
   * 过期清理
   */
  pruneExpired(): number {
    const now = new Date().toISOString();

    // 过期sessions
    const sessResult = this.db.prepare(`
      UPDATE wc_sessions SET active = 0 WHERE active = 1 AND expires_at < ?
    `).run(now);

    // 过期签名请求
    const reqResult = this.db.prepare(`
      UPDATE wc_sign_requests SET status = 'expired' WHERE status = 'pending' AND created_at < ?
    `).run(new Date(Date.now() - this.config.requestTimeoutMs).toISOString());

    const pruned = (sessResult.changes ?? 0) + (reqResult.changes ?? 0);

    if (pruned > 0) {
      this.loadSessions(); // 重新加载
      this.logger.info('WC expired items pruned', { pruned });
    }

    return pruned;
  }

  // ── Internal ──────────────────────────────────────────────────────

  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS wc_sessions (
        id TEXT PRIMARY KEY,
        peer_address TEXT NOT NULL,
        peer_chain_id INTEGER NOT NULL,
        peer_wallet_type TEXT NOT NULL,
        topic TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS wc_sign_requests (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        method TEXT NOT NULL,
        params_json TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        result TEXT,
        FOREIGN KEY (session_id) REFERENCES wc_sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_wc_sessions_active ON wc_sessions(active);
      CREATE INDEX IF NOT EXISTS idx_wc_sign_requests_status ON wc_sign_requests(status);
    `);
  }

  private loadSessions(): void {
    this.sessions.clear();
    const rows = this.db.prepare(
      `SELECT * FROM wc_sessions WHERE active = 1`,
    ).all() as Array<{
      id: string;
      peer_address: string;
      peer_chain_id: number;
      peer_wallet_type: string;
      topic: string;
      created_at: string;
      expires_at: string;
      active: number;
    }>;

    for (const r of rows) {
      this.sessions.set(r.id, {
        id: r.id,
        peerAddress: r.peer_address as `0x${string}`,
        peerChainId: r.peer_chain_id,
        peerWalletType: r.peer_wallet_type,
        topic: r.topic,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        active: r.active === 1,
      });
    }
  }
}
