/**
 * Phase 2D Tests — Facilitator Module
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockFacilitator } from './index.js';

describe('MockFacilitator', () => {
  let fac: MockFacilitator;

  beforeEach(() => {
    fac = new MockFacilitator({
      commissionRate: 0.02, // 2%
      minSettlementUsdc: 0.01,
      maxSettlementUsdc: 1000,
    });
  });

  it('verifies a payment', async () => {
    const result = await fac.verify({
      txHash: '0x1111111111111111111111111111111111111111111111111111111111111111' as `0x${string}`,
      expectedFrom: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`,
      expectedTo: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`,
      expectedAmountUsdc: 10,
      chainId: 8453,
    });
    expect(result.valid).toBe(true);
    expect(result.confirmedAmount).toBe(10);
  });

  it('rejects double-spend', async () => {
    const txHash = '0x2222222222222222222222222222222222222222222222222222222222222222' as `0x${string}`;
    const req = {
      txHash,
      expectedFrom: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`,
      expectedTo: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`,
      expectedAmountUsdc: 5,
      chainId: 8453,
    };

    const r1 = await fac.verify(req);
    expect(r1.valid).toBe(true);

    const r2 = await fac.verify(req);
    expect(r2.valid).toBe(false);
    expect(r2.reason).toContain('double-spend');
  });

  it('settles a valid amount', async () => {
    const result = await fac.settle({
      to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`,
      amountUsdc: 100,
      usdcAddress: '0xcccccccccccccccccccccccccccccccccccccccc' as `0x${string}`,
      signerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`,
    });
    expect(result.success).toBe(true);
    expect(result.txHash).toMatch(/^0x/);
  });

  it('rejects amount below minimum', async () => {
    const result = await fac.settle({
      to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`,
      amountUsdc: 0.001,
      usdcAddress: '0xcccccccccccccccccccccccccccccccccccccccc' as `0x${string}`,
      signerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('minimum');
  });

  it('rejects amount above maximum', async () => {
    const result = await fac.settle({
      to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`,
      amountUsdc: 5000,
      usdcAddress: '0xcccccccccccccccccccccccccccccccccccccccc' as `0x${string}`,
      signerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('maximum');
  });

  it('calculates fee correctly', () => {
    const { fee, net } = fac.calculateFee(100);
    expect(fee).toBe(2); // 2%
    expect(net).toBe(98);
  });

  it('tracks stats', async () => {
    await fac.verify({
      txHash: '0x3333333333333333333333333333333333333333333333333333333333333333' as `0x${string}`,
      expectedFrom: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`,
      expectedTo: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`,
      expectedAmountUsdc: 50,
      chainId: 8453,
    });
    await fac.settle({
      to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`,
      amountUsdc: 50,
      usdcAddress: '0xcccccccccccccccccccccccccccccccccccccccc' as `0x${string}`,
      signerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`,
    });

    const stats = fac.stats();
    expect(stats.totalVerified).toBe(1);
    expect(stats.totalSettled).toBe(1);
    expect(stats.totalCommissionUsdc).toBe(1); // 2% of 50
    expect(stats.processedTxHashes).toBe(1);
  });
});
