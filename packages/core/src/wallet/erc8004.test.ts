/**
 * Phase 2D Tests — ERC-8004 Registry + ChainClient
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ERC8004Registry,
  ERC8004_ABI,
  USDC_ABI,
  type ChainClient,
} from './erc8004.js';

// ── Mock ChainClient ───────────────────────────────────────────────────

class MockChainClient implements ChainClient {
  private names = new Map<string, string>();
  private balances = new Map<string, bigint>();

  async readContract(params: any): Promise<any> {
    if (params.functionName === 'resolve') {
      const addr = this.names.get(params.args[0]);
      return addr ?? '0x' + '0'.repeat(40);
    }
    if (params.functionName === 'tokenOfOwner') return '1';
    if (params.functionName === 'nameOf') return 'TestAgent';
    if (params.functionName === 'metadataOf') return 'ipfs://meta';
    if (params.functionName === 'balanceOf') {
      return this.balances.get(params.args[0]) ?? 0n;
    }
    return null;
  }

  async writeContract(params: any): Promise<`0x${string}`> {
    if (params.functionName === 'register') {
      this.names.set(params.args[0], params.account);
    }
    return `0x${'ab'.repeat(32)}` as `0x${string}`;
  }

  async waitForReceipt(txHash: `0x${string}`): Promise<any> {
    return { status: 'success' as const, blockNumber: 12345n };
  }

  async getBalance(address: `0x${string}`): Promise<bigint> {
    return this.balances.get(address) ?? 1000000000000000000n; // 1 ETH
  }

  async getChainId(): Promise<number> {
    return 8453;
  }

  async estimateGas(): Promise<bigint> {
    return 150000n;
  }

  setBalance(addr: string, balance: bigint) {
    this.balances.set(addr, balance);
  }
}

// ── Logger mock ────────────────────────────────────────────────────────

const mockLogger: any = {
  child: () => mockLogger,
  info: () => {},
  warn: () => {},
  error: () => {},
};

// ── Tests ──────────────────────────────────────────────────────────────

describe('ERC8004Registry', () => {
  let client: MockChainClient;
  let registry: ERC8004Registry;

  beforeEach(() => {
    client = new MockChainClient();
    registry = new ERC8004Registry(client, mockLogger, {
      rpcUrl: 'https://mainnet.base.org',
      contractAddress: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
      chainId: 8453,
    });
  });

  it('registers an agent identity on-chain', async () => {
    const signer = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`;
    const identity = await registry.register('myagent', 'ipfs://metadata', signer);

    expect(identity.name).toBe('myagent');
    expect(identity.address).toBe(signer);
    expect(identity.txHash).toMatch(/^0x/);
    expect(identity.chainId).toBe(8453);
  });

  it('rejects duplicate name registration', async () => {
    const signer = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`;
    await registry.register('taken', 'ipfs://meta', signer);

    await expect(
      registry.register('taken', 'ipfs://meta2', signer),
    ).rejects.toThrow('already registered');
  });

  it('resolves names', async () => {
    const signer = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`;
    await registry.register('lookup-test', 'ipfs://m', signer);

    const resolved = await registry.resolve('lookup-test');
    expect(resolved).toBe(signer);
  });

  it('returns null for unknown names', async () => {
    const resolved = await registry.resolve('unknown-agent');
    expect(resolved).toBeNull();
  });

  it('gets identity for an address', async () => {
    const addr = '0xcccccccccccccccccccccccccccccccccccccccc' as `0x${string}`;
    const identity = await registry.getIdentity(addr);
    expect(identity).not.toBeNull();
    expect(identity!.name).toBe('TestAgent');
  });

  it('gets ETH balance', async () => {
    const addr = '0xdddddddddddddddddddddddddddddddddddddd' as `0x${string}`;
    const balance = await registry.getEthBalance(addr);
    expect(parseFloat(balance)).toBeGreaterThan(0);
  });

  it('exposes contract address and chain id', () => {
    expect(registry.contractAddr).toMatch(/^0x/);
    expect(registry.chain).toBe(8453);
  });
});

describe('ABI Definitions', () => {
  it('ERC-8004 ABI has expected functions', () => {
    const fns = ERC8004_ABI.filter((e: any) => e.type === 'function').map((e: any) => e.name);
    expect(fns).toContain('register');
    expect(fns).toContain('resolve');
    expect(fns).toContain('updateMetadata');
  });

  it('USDC ABI has transfer and balanceOf', () => {
    const fns = USDC_ABI.filter((e: any) => e.type === 'function').map((e: any) => e.name);
    expect(fns).toContain('transfer');
    expect(fns).toContain('balanceOf');
    expect(fns).toContain('approve');
  });
});
