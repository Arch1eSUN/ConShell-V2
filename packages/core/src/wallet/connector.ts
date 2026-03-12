/**
 * WalletConnector — 统一钱包连接抽象层
 *
 * 支持多种连接方式:
 *  - local: server-side viem私钥 (已有)
 *  - external: MetaMask / Coinbase / Rainbow / WalletConnect
 *
 * 外部钱包通过事件机制通知:
 *  - accountChanged
 *  - chainChanged
 *  - disconnected
 */
import type { Logger } from '../types/common.js';
import type { TypedDataParams } from './index.js';

// ── Types ──────────────────────────────────────────────────────────────

export type WalletType = 'local' | 'metamask' | 'coinbase' | 'rainbow' | 'walletconnect' | 'injected';

export type WalletEvent = 'accountChanged' | 'chainChanged' | 'disconnected' | 'connected';

export interface ConnectedWallet {
  readonly type: WalletType;
  readonly address: `0x${string}`;
  readonly chainId: number;
  readonly label: string;
}

export interface WalletConnector {
  /** 钱包类型 */
  readonly type: WalletType;
  /** 显示名称 */
  readonly label: string;
  /** 是否已连接 */
  isConnected(): boolean;
  /** 获取当前地址 */
  getAddress(): `0x${string}` | null;
  /** 获取当前链ID */
  getChainId(): number | null;
  /** 连接钱包 */
  connect(): Promise<ConnectedWallet>;
  /** 断开连接 */
  disconnect(): Promise<void>;
  /** 签名消息 */
  sign(message: string): Promise<`0x${string}`>;
  /** EIP-712签名 */
  signTypedData(params: TypedDataParams): Promise<`0x${string}`>;
  /** 事件监听 */
  on(event: WalletEvent, callback: (data: unknown) => void): void;
  /** 移除监听 */
  off(event: WalletEvent, callback: (data: unknown) => void): void;
}

// ── Event Emitter ──────────────────────────────────────────────────────

type EventHandler = (data: unknown) => void;

class WalletEventEmitter {
  private handlers = new Map<WalletEvent, Set<EventHandler>>();

  on(event: WalletEvent, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: WalletEvent, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  protected emit(event: WalletEvent, data: unknown): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try { handler(data); } catch { /* swallow listener errors */ }
      }
    }
  }
}

// ── Local Wallet Connector ────────────────────────────────────────────

import { loadOrGenerateWallet, type WalletAccount } from './index.js';

export class LocalWalletConnector extends WalletEventEmitter implements WalletConnector {
  readonly type: WalletType = 'local';
  readonly label = 'Local Wallet (server-side)';
  private account: WalletAccount | null = null;
  private readonly logger: Logger;
  private readonly walletPath: string;

  constructor(walletPath: string, logger: Logger) {
    super();
    this.walletPath = walletPath;
    this.logger = logger.child('wallet-connector:local');
  }

  isConnected(): boolean { return this.account !== null; }

  getAddress(): `0x${string}` | null {
    return this.account?.address ?? null;
  }

  getChainId(): number | null {
    return this.isConnected() ? 8453 : null; // Base mainnet
  }

  async connect(): Promise<ConnectedWallet> {
    this.account = loadOrGenerateWallet(this.walletPath);

    const wallet: ConnectedWallet = {
      type: 'local',
      address: this.account.address,
      chainId: 8453,
      label: this.label,
    };

    this.emit('connected', wallet);
    this.logger.info('Local wallet connected', { address: wallet.address });
    return wallet;
  }

  async disconnect(): Promise<void> {
    this.account = null;
    this.emit('disconnected', null);
  }

  async sign(message: string): Promise<`0x${string}`> {
    if (!this.account) throw new Error('Wallet not connected');
    // Placeholder: real impl uses ethers/viem
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256').update(message + this.account.privateKey).digest('hex');
    return `0x${hash}` as `0x${string}`;
  }

  async signTypedData(_params: TypedDataParams): Promise<`0x${string}`> {
    if (!this.account) throw new Error('Wallet not connected');
    // Placeholder: real impl uses ethers/viem EIP-712
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256').update(JSON.stringify(_params) + this.account.privateKey).digest('hex');
    return `0x${hash}` as `0x${string}`;
  }

  on(event: WalletEvent, callback: EventHandler): void { super.on(event, callback); }
  off(event: WalletEvent, callback: EventHandler): void { super.off(event, callback); }
}

// ── External Wallet Connector (for Dashboard/WalletConnect) ───────────

/**
 * ExternalWalletConnector — 外部钱包代理
 *
 * Dashboard前端通过WebSocket将钱包状态同步到Agent后端。
 * Agent后端通过此connector与外部钱包交互。
 *
 * 流程:
 *  1. Dashboard连接MetaMask/Coinbase/Rainbow（via wagmi）
 *  2. Dashboard通过WS发送 { type: 'wallet_connected', address, chainId }
 *  3. Agent后端创建ExternalWalletConnector实例
 *  4. 需要签名时，Agent发送WS请求，Dashboard转发给钱包
 */
export class ExternalWalletConnector extends WalletEventEmitter implements WalletConnector {
  readonly type: WalletType;
  readonly label: string;
  private address: `0x${string}` | null = null;
  private chainId: number | null = null;
  private connected = false;
  private readonly logger: Logger;

  // 签名请求回调 — Dashboard通过WS注入
  private signCallback: ((message: string) => Promise<`0x${string}`>) | null = null;
  private signTypedDataCallback: ((params: TypedDataParams) => Promise<`0x${string}`>) | null = null;

  constructor(type: WalletType, label: string, logger: Logger) {
    super();
    this.type = type;
    this.label = label;
    this.logger = logger.child(`wallet-connector:${type}`);
  }

  isConnected(): boolean { return this.connected; }
  getAddress(): `0x${string}` | null { return this.address; }
  getChainId(): number | null { return this.chainId; }

  /**
   * 从Dashboard WS消息更新状态
   */
  updateFromDashboard(data: {
    address: `0x${string}`;
    chainId: number;
    connected: boolean;
  }): void {
    const wasConnected = this.connected;
    this.address = data.address;
    this.chainId = data.chainId;
    this.connected = data.connected;

    if (data.connected && !wasConnected) {
      this.emit('connected', { type: this.type, address: data.address, chainId: data.chainId, label: this.label });
      this.logger.info('External wallet connected via Dashboard', { type: this.type, address: data.address, chainId: data.chainId });
    } else if (!data.connected && wasConnected) {
      this.emit('disconnected', null);
      this.logger.info('External wallet disconnected', { type: this.type });
    }

    if (data.chainId !== this.chainId) {
      this.emit('chainChanged', data.chainId);
    }
    if (data.address !== this.address) {
      this.emit('accountChanged', data.address);
    }
  }

  /**
   * 注册签名回调（Dashboard WS桥接注入）
   */
  setSignCallbacks(
    signFn: (message: string) => Promise<`0x${string}`>,
    signTypedFn: (params: TypedDataParams) => Promise<`0x${string}`>,
  ): void {
    this.signCallback = signFn;
    this.signTypedDataCallback = signTypedFn;
  }

  async connect(): Promise<ConnectedWallet> {
    if (!this.connected || !this.address) {
      throw new Error(`External wallet ${this.type} must be connected from Dashboard first`);
    }
    return {
      type: this.type,
      address: this.address,
      chainId: this.chainId ?? 8453,
      label: this.label,
    };
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.address = null;
    this.chainId = null;
    this.emit('disconnected', null);
  }

  async sign(message: string): Promise<`0x${string}`> {
    if (!this.signCallback) throw new Error(`No sign callback registered for ${this.type}`);
    if (!this.connected) throw new Error('Wallet not connected');
    return this.signCallback(message);
  }

  async signTypedData(params: TypedDataParams): Promise<`0x${string}`> {
    if (!this.signTypedDataCallback) throw new Error(`No signTypedData callback for ${this.type}`);
    if (!this.connected) throw new Error('Wallet not connected');
    return this.signTypedDataCallback(params);
  }

  on(event: WalletEvent, callback: EventHandler): void { super.on(event, callback); }
  off(event: WalletEvent, callback: EventHandler): void { super.off(event, callback); }
}

// ── Wallet Manager ────────────────────────────────────────────────────

/**
 * WalletManager — 管理所有钱包连接
 *
 * - 一个 primary wallet (Local, 用于Agent自主操作)
 * - 多个 external wallets (用户通过Dashboard连接)
 */
export class WalletManager {
  private readonly connectors = new Map<string, WalletConnector>();
  private primaryId: string | null = null;
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child('wallet-manager');
  }

  /**
   * 注册钱包连接器
   */
  register(id: string, connector: WalletConnector, isPrimary = false): void {
    this.connectors.set(id, connector);
    if (isPrimary || !this.primaryId) {
      this.primaryId = id;
    }
    this.logger.info('Wallet connector registered', { id, type: connector.type, isPrimary });
  }

  /**
   * 获取主钱包
   */
  getPrimary(): WalletConnector | undefined {
    return this.primaryId ? this.connectors.get(this.primaryId) : undefined;
  }

  /**
   * 获取指定连接器
   */
  get(id: string): WalletConnector | undefined {
    return this.connectors.get(id);
  }

  /**
   * 列出所有已连接的钱包
   */
  listConnected(): ConnectedWallet[] {
    const result: ConnectedWallet[] = [];
    for (const connector of this.connectors.values()) {
      if (connector.isConnected()) {
        const addr = connector.getAddress();
        if (addr) {
          result.push({
            type: connector.type,
            address: addr,
            chainId: connector.getChainId() ?? 0,
            label: connector.label,
          });
        }
      }
    }
    return result;
  }

  /**
   * 获取所有钱包地址
   */
  getAllAddresses(): `0x${string}`[] {
    return this.listConnected().map(w => w.address);
  }

  /**
   * 总钱包数
   */
  count(): number {
    return this.connectors.size;
  }

  /**
   * 已连接数
   */
  connectedCount(): number {
    return this.listConnected().length;
  }
}
