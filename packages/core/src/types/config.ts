/**
 * 应用配置接口
 */
import type { SecurityLevel } from './common.js';

/** 钱包配置 */
export interface WalletConfig {
  /** 支持的链列表 */
  readonly chains: ('base' | 'ethereum')[];
  /** 主链 */
  readonly primaryChain: 'base' | 'ethereum';
  /** 各链USDC合约地址 */
  readonly usdcAddresses: Record<string, `0x${string}`>;
  /** 各链RPC URL */
  readonly rpcUrls: Record<string, string>;
  /** WalletConnect Project ID */
  readonly walletConnectProjectId?: string;
  /** 允许的外部钱包类型 */
  readonly allowedWalletTypes?: ('metamask' | 'coinbase' | 'rainbow' | 'walletconnect' | 'injected')[];
  /** 签名请求超时(ms) */
  readonly signRequestTimeoutMs?: number;
}

/** 推理模式 */
export type InferenceMode = 'ollama' | 'cliproxy' | 'direct-api' | 'conway-cloud';

/** 直连API Provider名称 */
export type ApiProvider = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'openrouter';

/** Browser Provider */
export type BrowserProvider = 'playwright' | 'cdp' | 'none';

/** 用户界面选择 */
export type InterfaceMode = 'repl' | 'webui';

/** 完整应用配置 */
export interface AppConfig {
  // ── Agent 身份 ───
  readonly agentName: string;
  readonly genesisPrompt: string;

  // ── 推理 ─────────
  readonly inferenceMode: InferenceMode;
  readonly model: string;
  readonly ollamaUrl?: string;
  readonly proxyBaseUrl?: string;
  readonly apiKey?: string;
  readonly apiProvider?: ApiProvider;
  readonly proxyEnabled: boolean;
  readonly proxyApiKey?: string;

  // ── 安全 ─────────
  readonly securityLevel: SecurityLevel;
  readonly constitutionAccepted: boolean;

  // ── 钱包 ─────────
  readonly walletEnabled: boolean;
  readonly walletConfig?: WalletConfig;

  // ── 渠道 ─────────
  readonly channels: string[];
  readonly channelCredentials: Record<string, Record<string, string>>;

  // ── 技能 ─────────
  readonly skillsDir: string;
  readonly clawHubToken?: string;

  // ── 浏览器 ───────
  readonly browserProvider: BrowserProvider;
  readonly browserHeadless: boolean;

  // ── 界面 ─────────
  readonly interface: InterfaceMode;
  readonly port: number;

  // ── 运行时 ───────
  readonly agentHome: string;
  readonly dbPath: string;
  readonly logLevel: string;
  readonly authMode: string;
  readonly dailyBudgetCents: number;

  // ── 元信息 ───────
  readonly completedAt?: string;
}
