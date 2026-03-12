/**
 * Config — zod验证配置加载器
 *
 * Loads config.json → merges .env → validates with zod schema.
 * Provides typed defaults, hot-reload support, and save-back.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { z } from 'zod';
import type { AppConfig, InferenceMode, BrowserProvider, InterfaceMode, ApiProvider } from '../types/config.js';
import type { SecurityLevel } from '../types/common.js';

// ── Zod Schemas ─────────────────────────────────────────

const walletConfigSchema = z.object({
  chains: z.array(z.enum(['base', 'ethereum'])).default(['base']),
  primaryChain: z.enum(['base', 'ethereum']).default('base'),
  usdcAddresses: z.record(z.string().startsWith('0x')).default({
    base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  }),
  rpcUrls: z.record(z.string().url()).default({
    base: 'https://mainnet.base.org',
    ethereum: 'https://eth.drpc.org',
  }),
  walletConnectProjectId: z.string().optional(),
  allowedWalletTypes: z.array(z.enum(['metamask', 'coinbase', 'rainbow', 'walletconnect', 'injected'])).optional(),
  signRequestTimeoutMs: z.number().positive().default(30_000),
});

const appConfigSchema = z.object({
  // ── Agent 身份 ───
  agentName: z.string().min(1).default('ConShell Agent'),
  genesisPrompt: z.string().default('You are a sovereign AI agent.'),

  // ── 推理 ─────────
  inferenceMode: z.enum(['ollama', 'cliproxy', 'direct-api', 'conway-cloud']).default('ollama'),
  model: z.string().min(1).default('llama3'),
  ollamaUrl: z.string().url().optional(),
  proxyBaseUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
  apiProvider: z.enum(['openai', 'anthropic', 'google', 'deepseek', 'openrouter']).optional(),
  proxyEnabled: z.boolean().default(false),
  proxyApiKey: z.string().optional(),

  // ── 安全 ─────────
  securityLevel: z.enum(['sandbox', 'standard', 'autonomous', 'godmode']).default('standard'),
  constitutionAccepted: z.boolean().default(false),

  // ── 钱包 ─────────
  walletEnabled: z.boolean().default(false),
  walletConfig: walletConfigSchema.optional(),

  // ── 渠道 ─────────
  channels: z.array(z.string()).default([]),
  channelCredentials: z.record(z.record(z.string())).default({}),

  // ── 技能 ─────────
  skillsDir: z.string().default('~/.conshell/skills'),
  clawHubToken: z.string().optional(),

  // ── 浏览器 ───────
  browserProvider: z.enum(['playwright', 'cdp', 'none']).default('none'),
  browserHeadless: z.boolean().default(true),

  // ── 界面 ─────────
  interface: z.enum(['repl', 'webui']).default('repl'),
  port: z.number().int().min(1).max(65535).default(4200),

  // ── 运行时 ───────
  agentHome: z.string().default(path.join(os.homedir(), '.conshell')),
  dbPath: z.string().default('state.db'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
  authMode: z.enum(['none', 'jwt', 'siwe']).default('none'),
  dailyBudgetCents: z.number().int().min(0).default(500),

  // ── 元信息 ───────
  completedAt: z.string().optional(),
});

export type ValidatedConfig = z.infer<typeof appConfigSchema>;

// ── Env Mapping ─────────────────────────────────────────

const ENV_MAP: Record<string, { key: keyof ValidatedConfig; transform?: (v: string) => unknown }> = {
  CONSHELL_API_KEY:       { key: 'apiKey' },
  CONSHELL_PORT:          { key: 'port', transform: (v) => parseInt(v, 10) },
  CONSHELL_AGENT_NAME:    { key: 'agentName' },
  CONSHELL_MODEL:         { key: 'model' },
  CONSHELL_INFERENCE:     { key: 'inferenceMode' },
  CONSHELL_SECURITY:      { key: 'securityLevel' },
  CONSHELL_LOG_LEVEL:     { key: 'logLevel' },
  CONSHELL_AUTH_MODE:     { key: 'authMode' },
  CONSHELL_INTERFACE:     { key: 'interface' },
  CONSHELL_BROWSER:       { key: 'browserProvider' },
  CONSHELL_DAILY_BUDGET:  { key: 'dailyBudgetCents', transform: (v) => parseInt(v, 10) },
  OLLAMA_URL:             { key: 'ollamaUrl' },
  CLIPROXY_URL:           { key: 'proxyBaseUrl' },
  CLIPROXY_KEY:           { key: 'proxyApiKey' },
  OPENAI_API_KEY:         { key: 'apiKey' },
  ANTHROPIC_API_KEY:      { key: 'apiKey' },
};

// ── Public API ──────────────────────────────────────────

const DEFAULT_HOME = path.join(os.homedir(), '.conshell');

/**
 * Load, merge, and validate configuration.
 * Priority: env > config.json > schema defaults
 */
export function loadConfig(agentHome?: string): AppConfig {
  const home = agentHome ?? process.env['CONSHELL_HOME'] ?? DEFAULT_HOME;
  const configPath = path.join(home, 'config.json');

  // 1. Read file config
  let fileConfig: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch { /* corrupt config — fall through to defaults */ }
  }

  // 2. Collect env overrides
  const envOverrides: Record<string, unknown> = {};
  for (const [envKey, { key, transform }] of Object.entries(ENV_MAP)) {
    const val = process.env[envKey];
    if (val !== undefined) {
      envOverrides[key] = transform ? transform(val) : val;
    }
  }

  // 3. Merge: defaults ← file ← env
  const merged = { agentHome: home, ...fileConfig, ...envOverrides };

  // 4. Validate with zod (safe parse → log warnings, never throw on unknown fields)
  const result = appConfigSchema.safeParse(merged);
  if (!result.success) {
    const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    console.warn(`⚠️  Config validation warnings:\n${issues}`);
    // Return best-effort merge with defaults
    return appConfigSchema.parse({ agentHome: home }) as unknown as AppConfig;
  }

  return result.data as unknown as AppConfig;
}

/**
 * Save partial config back to config.json.
 * Merges with existing file content to preserve fields not being updated.
 */
export function saveConfig(config: Partial<AppConfig>, agentHome?: string): void {
  const home = agentHome ?? process.env['CONSHELL_HOME'] ?? DEFAULT_HOME;
  const configPath = path.join(home, 'config.json');
  if (!fs.existsSync(home)) fs.mkdirSync(home, { recursive: true });

  // Merge with existing
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try { existing = JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch { /* overwrite */ }
  }

  const merged = { ...existing, ...config };
  // Strip runtime-only fields
  delete (merged as Record<string, unknown>).agentHome;

  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2) + '\n');
}

/**
 * Watch config file for changes and invoke callback.
 */
export function watchConfig(
  callback: (config: AppConfig) => void,
  agentHome?: string,
): () => void {
  const home = agentHome ?? process.env['CONSHELL_HOME'] ?? DEFAULT_HOME;
  const configPath = path.join(home, 'config.json');

  const watcher = fs.watch(configPath, { persistent: false }, (_event) => {
    try {
      const updated = loadConfig(home);
      callback(updated);
    } catch { /* ignore transient read errors during write */ }
  });

  return () => watcher.close();
}

/** Export schema for external validation */
export { appConfigSchema };
