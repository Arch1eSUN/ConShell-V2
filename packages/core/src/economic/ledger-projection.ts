/**
 * LedgerProjection — SpendTracker → EconomicLedger 投影链
 *
 * Round 15.7B: 将 SpendTracker 的 spend/income 事件实时投影到
 * EconomicLedger 的哈希链中，提供审计完整性验证。
 *
 * SpendRepository 保持为 canonical persisted truth。
 * EconomicLedger 作为确定性投影 + 哈希链审计链。
 */
import { EconomicLedger, type LedgerSnapshot } from './economic-ledger.js';
import type { SpendTracker, SpendRecord, IncomeRecord } from '../spend/index.js';

export class LedgerProjection {
  private ledger: EconomicLedger;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.ledger = new EconomicLedger();
  }

  /**
   * Wire a SpendTracker — all future spend/income events will be
   * projected into the EconomicLedger as hash-chained entries.
   */
  wire(tracker: SpendTracker): void {
    // Unsubscribe from previous tracker if any
    this.unsubscribe?.();

    this.unsubscribe = tracker.onRecord((type, record) => {
      if (type === 'spend') {
        const spend = record as SpendRecord;
        this.ledger.append(
          'debit',
          spend.costCents,
          spend.category,
          spend.provider,
          spend.description ?? `${spend.category}: ${spend.model ?? spend.provider}`,
          new Date(spend.timestamp).toISOString(),
        );
      } else {
        const income = record as IncomeRecord;
        this.ledger.append(
          'credit',
          income.amountCents,
          'revenue',
          income.source,
          `Income from ${income.source}${income.txHash ? ` (tx: ${income.txHash})` : ''}`,
          new Date(income.timestamp).toISOString(),
        );
      }
    });
  }

  /**
   * Verify the integrity of the projected ledger chain.
   * Returns true if the chain is unbroken and all hashes are valid.
   */
  verify(): boolean {
    return this.ledger.verify().valid;
  }

  /**
   * Get the underlying EconomicLedger snapshot for reporting.
   */
  getSnapshot(): LedgerSnapshot {
    return this.ledger.snapshot();
  }

  /**
   * Get the underlying EconomicLedger instance.
   */
  getLedger(): EconomicLedger {
    return this.ledger;
  }

  /**
   * Disconnect from SpendTracker.
   */
  disconnect(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
