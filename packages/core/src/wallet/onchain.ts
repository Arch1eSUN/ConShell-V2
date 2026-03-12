/**
 * OnchainProvider — 链上余额查询
 *
 * 支持:
 *  - Base mainnet (chainId=8453) — 主链, x402协议运行链
 *  - Ethereum mainnet (chainId=1) — 辅助链
 *
 * 查询:
 *  - ETH余额
 *  - USDC余额 (ERC-20)
 *  - 总价值转换 (cents)
 *
 * 从V1 OnchainWalletProvider移植并增强。
 */
import { createPublicClient, http, formatUnits, type PublicClient, type Chain } from 'viem';
import { base, mainnet } from 'viem/chains';
import type { Logger } from '../types/common.js';

// ── Chain Configurations ──────────────────────────────────────────────

export interface ChainConfig {
  readonly chain: Chain;
  readonly usdcAddress: `0x${string}`;
  readonly rpcUrl?: string;
}

/** 默认链配置 */
export const DEFAULT_CHAINS: Record<string, ChainConfig> = {
  base: {
    chain: base,
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base mainnet USDC
  },
  ethereum: {
    chain: mainnet,
    usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Ethereum mainnet USDC
  },
};

// ── ERC-20 ABI (minimal) ──────────────────────────────────────────────

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs: [{ name: 'account', type: 'address' as const }],
    outputs: [{ name: 'balance', type: 'uint256' as const }],
  },
  {
    name: 'decimals',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs: [] as const,
    outputs: [{ name: 'decimals', type: 'uint8' as const }],
  },
] as const;

// ── Types ──────────────────────────────────────────────────────────────

export interface ChainBalance {
  readonly chainName: string;
  readonly chainId: number;
  /** ETH余额 (wei) */
  readonly ethWei: bigint;
  /** ETH余额 (格式化) */
  readonly ethFormatted: string;
  /** USDC余额 (raw, 6 decimals) */
  readonly usdcRaw: bigint;
  /** USDC余额 (格式化) */
  readonly usdcFormatted: string;
  /** USDC折算为cents */
  readonly usdcCents: number;
}

export interface AggregatedBalance {
  /** 各链余额 */
  readonly chains: ChainBalance[];
  /** 总USDC (cents) */
  readonly totalUsdcCents: number;
  /** 总ETH (wei) */
  readonly totalEthWei: bigint;
  /** 查询时间 */
  readonly queriedAt: string;
}

// ── OnchainProvider ───────────────────────────────────────────────────

export class OnchainProvider {
  private readonly clients = new Map<string, { client: PublicClient; config: ChainConfig }>();
  private readonly logger: Logger;
  private lastQuery: AggregatedBalance | null = null;

  constructor(
    chainConfigs: Record<string, ChainConfig>,
    logger: Logger,
  ) {
    this.logger = logger.child('onchain');

    for (const [name, config] of Object.entries(chainConfigs)) {
      const client = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
      }) as unknown as PublicClient;

      this.clients.set(name, { client, config });
      this.logger.info('Chain client initialized', {
        chain: name,
        chainId: config.chain.id,
      });
    }
  }

  /**
   * 查询单条链余额
   */
  async getChainBalance(
    chainName: string,
    address: `0x${string}`,
  ): Promise<ChainBalance> {
    const entry = this.clients.get(chainName);
    if (!entry) {
      throw new Error(`Chain not configured: ${chainName}`);
    }

    const { client, config } = entry;

    try {
      // 并行查询 ETH + USDC
      const [ethWei, usdcRaw] = await Promise.all([
        client.getBalance({ address }),
        client.readContract({
          address: config.usdcAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        }),
      ]);

      const ethFormatted = formatUnits(ethWei, 18);
      const usdcFormatted = formatUnits(usdcRaw as bigint, 6);
      // USDC has 6 decimals: raw / 10_000 = cents (2 decimals)
      const usdcCents = Number(usdcRaw as bigint) / 10_000;

      return {
        chainName,
        chainId: config.chain.id,
        ethWei,
        ethFormatted,
        usdcRaw: usdcRaw as bigint,
        usdcFormatted,
        usdcCents,
      };
    } catch (err) {
      this.logger.error('Failed to query chain balance', {
        chain: chainName,
        address,
        error: err instanceof Error ? err.message : String(err),
      });

      // 返回零余额 — 保守模式
      return {
        chainName,
        chainId: config.chain.id,
        ethWei: 0n,
        ethFormatted: '0',
        usdcRaw: 0n,
        usdcFormatted: '0',
        usdcCents: 0,
      };
    }
  }

  /**
   * 查询所有链余额（聚合）
   */
  async getAggregatedBalance(address: `0x${string}`): Promise<AggregatedBalance> {
    const chainNames = Array.from(this.clients.keys());

    const balances = await Promise.all(
      chainNames.map(name => this.getChainBalance(name, address)),
    );

    const totalUsdcCents = balances.reduce((sum, b) => sum + b.usdcCents, 0);
    const totalEthWei = balances.reduce((sum, b) => sum + b.ethWei, 0n);

    const result: AggregatedBalance = {
      chains: balances,
      totalUsdcCents,
      totalEthWei,
      queriedAt: new Date().toISOString(),
    };

    this.lastQuery = result;

    this.logger.info('Aggregated balance queried', {
      address,
      totalUsdcCents,
      chains: balances.map(b => `${b.chainName}:$${b.usdcFormatted}`).join(', '),
    });

    return result;
  }

  /**
   * 获取上次查询缓存（避免频繁链上调用）
   */
  getLastQuery(): AggregatedBalance | null {
    return this.lastQuery;
  }

  /**
   * 快速判断能否存活（USDC > 0）
   */
  async canSurvive(address: `0x${string}`): Promise<boolean> {
    const agg = await this.getAggregatedBalance(address);
    return agg.totalUsdcCents > 0;
  }

  /**
   * 获取已配置的链名列表
   */
  getChainNames(): string[] {
    return Array.from(this.clients.keys());
  }
}

/**
 * 创建默认 OnchainProvider (Base + Ethereum)
 */
export function createDefaultOnchainProvider(
  logger: Logger,
  overrides?: Partial<Record<string, ChainConfig>>,
): OnchainProvider {
  const configs: Record<string, ChainConfig> = { ...DEFAULT_CHAINS };
  if (overrides) {
    for (const [key, val] of Object.entries(overrides)) {
      if (val) configs[key] = val;
    }
  }
  return new OnchainProvider(configs, logger);
}
