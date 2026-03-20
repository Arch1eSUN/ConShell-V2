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

// ── Round 17.7: Economic Kernel Foundation ────────────────────────────

// G1: Economic Identity
export type {
  EconomicIdentity,
  EconomicIdentityStatus,
  EconomicIdentityCreateInput,
} from './economic-identity.js';
export {
  EconomicIdentityRegistry,
} from './economic-identity.js';

// G2: Economic Action Classification
export type {
  EconomicActionKind,
  EconomicRiskLevel,
  ActionSource,
  CandidateEconomicAction,
  ActionClassification,
} from './economic-action-classification.js';
export {
  ACTION_RISK_DEFAULTS,
  EXTERNAL_SOURCES,
  classifyAction,
  createCandidate,
} from './economic-action-classification.js';

// G3: Capability Envelope
export type {
  CapabilityScope,
  CapabilityEnvelope,
  CapabilityChangeEvent,
} from './capability-envelope.js';
export {
  ALL_CAPABILITY_SCOPES,
  CapabilityEnvelopeManager,
} from './capability-envelope.js';

// G4: Mandate Engine
export type {
  Mandate,
  MandateStatus,
  MandateCreateInput,
  MandateMatchResult,
} from './mandate-engine.js';
export {
  MandateEngine,
} from './mandate-engine.js';

// G5: Economic Instruction Firewall
export type {
  FirewallDecision,
  FirewallVerdict,
  FirewallChecks,
  FirewallStats,
  SourceTrustCheck,
  PolicyCheckResult,
  RiskScoringResult,
  CapabilityCheckResult,
  MandateCheckResult,
} from './economic-instruction-firewall.js';
export {
  EconomicInstructionFirewall,
} from './economic-instruction-firewall.js';

// G6: Economic Audit Event
export type {
  EconomicAuditEvent,
  EconomicAuditEventInput,
  AuditStats,
} from './economic-audit-event.js';
export {
  EconomicAuditLog,
} from './economic-audit-event.js';

// G7: Economic Kernel Foundation
export type {
  EconomicKernelFoundation,
} from './economic-kernel-foundation.js';
export {
  createEconomicKernelFoundation,
} from './economic-kernel-foundation.js';

// ── Round 17.8: Economic Truth Surface + Reward/Claim Foundation ──────

// G1-G3: Economic Truth Report
export type {
  EconomicTruthReport,
  IdentityDiagnostics,
  CapabilityDiagnostics,
  MandateDiagnostics,
  FirewallDiagnostics,
  RewardClaimSummary,
  EconomicWarning,
  WarningLevel,
  DerivedFact,
  TruthReportDependencies,
} from './economic-truth-report.js';
export {
  generateEconomicTruthReport,
} from './economic-truth-report.js';

// G4-G5: Reward Definition + Eligibility
export type {
  RewardKind,
  RewardStatus,
  EligibilityRuleKind,
  EligibilityRule,
  RewardDefinition,
  RewardCreateInput,
  EligibilityCheckResult,
} from './reward-definition.js';
export {
  RewardRegistry,
} from './reward-definition.js';

// G6: Claim Lifecycle
export type {
  ClaimStatus,
  ClaimAttempt,
  ClaimReceipt,
  ClaimResult,
  ClaimStats,
} from './claim-lifecycle.js';
export {
  ClaimEngine,
} from './claim-lifecycle.js';

// ── Round 17.9: Payment Negotiation + Provider Selection ──────────────

// G1-G2-G4: Payment Negotiation Contracts + Engine + 402 Model
export type {
  PricingMode,
  SettlementKind,
  PaymentRequirement,
  PaymentRequirementCreateInput,
  PaymentOffer,
  NegotiationDecision,
  NegotiationRejectionCategory,
  NegotiationRejectionReason,
  PaymentNegotiationRequest,
  PaymentNegotiationResult,
  ConShell402Requirement,
  ConShell402Response,
  NegotiationStats,
} from './payment-negotiation.js';
export {
  PaymentNegotiationEngine,
} from './payment-negotiation.js';

// G3-G6: Provider Selection + Policy-Bound Routing
export type {
  ProviderProfile,
  ProviderProfileCreateInput,
  SelectionCriteria,
  SelectionConstraint,
  OfferComparison,
  ProviderSelectionResult,
  NoPayAlternative,
} from './provider-selection.js';
export {
  ProviderSelector,
} from './provider-selection.js';

// G5-G7: Payment Preparation + Audit Trail
export type {
  PreparationStatus,
  PaymentPreparationIntent,
  NegotiationAuditEventType,
  PaymentNegotiationAuditEvent,
  NegotiationSummary,
  ProviderSelectionSummary,
  PendingConfirmationSummary,
} from './payment-preparation.js';
export {
  PaymentPreparationManager,
  PaymentNegotiationAuditLog,
} from './payment-preparation.js';

