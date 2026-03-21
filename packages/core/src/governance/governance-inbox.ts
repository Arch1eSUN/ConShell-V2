/**
 * Round 20.1 — GovernanceInbox
 *
 * Unified inbox that aggregates all pending governance items:
 * spawn proposals, budget requests, blocked items, and held items
 * needing operator attention.
 */
import type { GovernanceService } from './governance-service.js';

// ── Types ───────────────────────────────────────────────────────────

export type InboxItemCategory = 'spawn' | 'budget' | 'blocked' | 'hold';

export type InboxItemPriority = 'low' | 'medium' | 'high' | 'critical';

export interface InboxItem {
  /** Unique ID (maps to proposal ID) */
  id: string;
  /** Category for UI grouping */
  category: InboxItemCategory;
  /** Display priority */
  priority: InboxItemPriority;
  /** Current governance status */
  status: string;
  /** Human-readable title */
  title: string;
  /** Human-readable summary */
  summary: string;
  /** Who initiated the action */
  initiatedBy: string;
  /** Action kind */
  actionKind: string;
  /** Expected cost */
  expectedCostCents: number;
  /** When the item was created */
  createdAt: string;
  /** How long this item has been waiting (ms) */
  waitingMs: number;
  /** Whether urgent action is needed */
  urgent: boolean;
}

export interface InboxSummary {
  items: InboxItem[];
  totalCount: number;
  urgentCount: number;
  countByCategory: Record<string, number>;
}

// ── GovernanceInbox ─────────────────────────────────────────────────

export class GovernanceInbox {
  constructor(private governance: GovernanceService) {}

  /**
   * Get the unified inbox — all items needing operator attention.
   */
  getInbox(filter?: { category?: InboxItemCategory }): InboxSummary {
    const now = Date.now();

    // Collect all pending/escalated proposals
    const pending = this.governance.listProposals({ status: 'proposed' as any });
    const escalated = this.governance.listProposals({ status: 'escalated' as any });
    const allCandidates = [...pending, ...escalated];

    let items: InboxItem[] = allCandidates.map(p => {
      const category = this.categorize(p.actionKind, p.status);
      const waitingMs = now - new Date(p.createdAt).getTime();
      const urgent = waitingMs > 60_000 || p.riskLevel === 'critical';

      return {
        id: p.id,
        category,
        priority: this.riskToPriority(p.riskLevel),
        status: p.status,
        title: `${p.actionKind}: ${p.target}`,
        summary: p.justification,
        initiatedBy: p.initiator.identityId,
        actionKind: p.actionKind,
        expectedCostCents: p.expectedCostCents,
        createdAt: p.createdAt,
        waitingMs,
        urgent,
      };
    });

    // Apply filter
    if (filter?.category) {
      items = items.filter(i => i.category === filter.category);
    }

    // Sort: urgent first, then by priority, then by age (oldest first)
    items.sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      const prioOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const prioDiff = prioOrder[a.priority] - prioOrder[b.priority];
      if (prioDiff !== 0) return prioDiff;
      return a.waitingMs - b.waitingMs;
    });

    const countByCategory: Record<string, number> = {};
    for (const item of items) {
      countByCategory[item.category] = (countByCategory[item.category] ?? 0) + 1;
    }

    return {
      items,
      totalCount: items.length,
      urgentCount: items.filter(i => i.urgent).length,
      countByCategory,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private categorize(actionKind: string, status: string): InboxItemCategory {
    if (actionKind === 'replication' || actionKind === 'fund_child') return 'spawn';
    if (actionKind === 'selfmod' || actionKind === 'dangerous_action') return 'blocked';
    if (status === 'escalated') return 'hold';
    return 'budget';
  }

  private riskToPriority(riskLevel: string): InboxItemPriority {
    switch (riskLevel) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      default: return 'low';
    }
  }
}
