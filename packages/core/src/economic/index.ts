/**
 * Round 15.7 — Economic Module Exports
 *
 * Unified entry point for the economic survival loop.
 * Provides createEconomicKernel() factory for one-shot initialization.
 */

// ── Economic State ───────────────────────────────────────────────────
export type {
  EconomicState,
  EconomicStateInput,
  EconomicHealth,
} from './economic-state.js';
export {
  buildEconomicState,
  isEconomicEmergency,
  classifyHealth,
  SURVIVAL_THRESHOLDS,
} from './economic-state.js';

// ── Economic Ledger ──────────────────────────────────────────────────
export type {
  LedgerEntry,
  LedgerEntryType,
  LedgerVerification,
  LedgerSnapshot,
} from './economic-ledger.js';
export {
  EconomicLedger,
  computeEntryHash,
} from './economic-ledger.js';

// ── Revenue Surfaces ─────────────────────────────────────────────────
export type {
  RevenueSurface,
  RevenueSurfaceType,
  PricePolicy,
  PaymentProofContract,
  PaymentProofStatus,
  RevenueSettlementStatus,
  RevenueReceipt,
  RevenueRecordedCallback,
} from './revenue-surface.js';
export {
  RevenueSurfaceRegistry,
  createX402Surface,
  createApiAccessSurface,
  createTaskServiceSurface,
  computeEffectivePrice,
  SURVIVAL_PRICE_MULTIPLIERS,
} from './revenue-surface.js';

// ── Survival Coupling ────────────────────────────────────────────────
export type {
  SurvivalConstraints,
  EnforcementResult,
} from './survival-coupling.js';
export {
  SurvivalGate,
  TIER_CONSTRAINTS,
} from './survival-coupling.js';

// ── Value Router ─────────────────────────────────────────────────────
export type {
  TaskValueEstimate,
  RoutingDecision,
  TaskDescriptor,
  TaskRiskLevel,
} from './value-router.js';
export {
  ValueRouter,
} from './value-router.js';

// ── Economic Narrator ────────────────────────────────────────────────
export type {
  NarrativeDecision,
  EconomicNarrative,
  EconomicReport,
} from './economic-narrator.js';
export {
  EconomicNarrator,
} from './economic-narrator.js';

// ── Transaction Safety ───────────────────────────────────────────────
export type {
  IdempotencyKey,
  RefundRequest,
  RefundStatus,
  TransactionRecord,
  TransactionStatus,
} from './transaction-safety.js';
export {
  TransactionSafetyManager,
  generateIdempotencyKey,
} from './transaction-safety.js';

// ── Round 15.7B: Runtime Integration ─────────────────────────────────
export type {
  EconomicGateDecision,
  EconomicProjection,
  SurvivalStateSummary,
} from './economic-state-service.js';
export {
  EconomicStateService,
} from './economic-state-service.js';
export {
  LedgerProjection,
} from './ledger-projection.js';

// ── Round 16.9: Revenue Service ───────────────────────────────────
export type {
  RevenueStats,
} from './revenue-service.js';
export {
  RevenueService,
} from './revenue-service.js';

// ── Round 16.9.1: Control Surface Contracts ────────────────────────
export type {
  AdmissionCode,
  TaskAdmissionDecision,
  SurvivalGateExplain,
  EconomicSnapshot,
  AgendaFactorSummary,
} from './control-surface-contracts.js';

// ── Round 15.8: Economic Policy + RuntimeMode + Value Events ─────────
export type {
  CostClass,
  ActionType,
  RuntimeMode,
  PolicyDecision,
  DecisionRecord,
} from './economic-policy.js';
export {
  EconomicPolicy,
  resolveRuntimeMode,
} from './economic-policy.js';
export type {
  RevenueEvent,
  ValueRealizationEvent,
  TaskCompletionEvent,
  ValueEvent,
} from './value-events.js';

// ── Round 15.9: ValueEventRecorder + TaskFeedbackHeuristic ───────────
export type {
  ValueEventStats,
} from './value-event-recorder.js';
export {
  ValueEventRecorder,
} from './value-event-recorder.js';
export type {
  TaskTypeRecord,
} from './task-feedback-heuristic.js';
export {
  TaskFeedbackHeuristic,
} from './task-feedback-heuristic.js';

// ── Round 16.0: EconomicMemory + Lifecycle + Report ──────────────────
export type {
  MemoryKey,
  MemoryRecord,
  MemoryRecordStats,
  MemoryPersistence,
} from './economic-memory-store.js';
export {
  EconomicMemoryStore,
} from './economic-memory-store.js';
export type {
  LifecycleStage,
  LifecycleTrack,
  LifecycleEntry,
} from './value-lifecycle-tracker.js';
export {
  ValueLifecycleTracker,
} from './value-lifecycle-tracker.js';
export type {
  EconomicPerformanceReport,
} from './economic-report.js';
export {
  generateEconomicPerformanceReport,
} from './economic-report.js';

// ── Factory ──────────────────────────────────────────────────────────

import { EconomicLedger } from './economic-ledger.js';
import { RevenueSurfaceRegistry } from './revenue-surface.js';
import { SurvivalGate } from './survival-coupling.js';
import { ValueRouter } from './value-router.js';
import { EconomicNarrator } from './economic-narrator.js';
import { TransactionSafetyManager } from './transaction-safety.js';

/**
 * The complete economic kernel — all components wired together.
 */
export interface EconomicKernel {
  readonly ledger: EconomicLedger;
  readonly revenueSurfaces: RevenueSurfaceRegistry;
  readonly revenueService: RevenueService;
  readonly survivalGate: SurvivalGate;
  readonly valueRouter: ValueRouter;
  readonly narrator: EconomicNarrator;
  readonly transactionSafety: TransactionSafetyManager;
}

import { RevenueService } from './revenue-service.js';

/**
 * Create and return a fully initialized economic kernel.
 * One-shot factory — call once at startup.
 */
export function createEconomicKernel(): EconomicKernel {
  const ledger = new EconomicLedger();
  return Object.freeze({
    ledger,
    revenueSurfaces: new RevenueSurfaceRegistry(),
    revenueService: new RevenueService(ledger),
    survivalGate: new SurvivalGate(),
    valueRouter: new ValueRouter(),
    narrator: new EconomicNarrator(),
    transactionSafety: new TransactionSafetyManager(),
  });
}
