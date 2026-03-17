/**
 * Collective module — Round 16.6 → 16.7
 *
 * Barrel export for collective/peer runtime types and services.
 */
export { CollectiveService } from './collective-service.js';
export type { CollectiveServiceOptions } from './collective-service.js';
export * from './collective-contract.js';
export { computeTrust, defaultTrust, type TrustEvidence, TRUST_WEIGHTS, tierFromScore } from './trust-model.js';

// Round 16.7 — Discovery
export { PeerDiscoveryService, ManualDiscoveryProvider, MockRegistryProvider } from './discovery-service.js';
export type { PeerDiscoveryServiceOptions } from './discovery-service.js';
export * from './discovery-contract.js';

// Round 16.7 — Reputation
export { ReputationService } from './reputation-service.js';
export type { ReputationServiceOptions } from './reputation-service.js';
export * from './reputation-contract.js';

// Round 16.7 — Peer Selector
export { PeerSelector, SELECTION_WEIGHTS } from './peer-selector.js';
export type { PeerSelectionCriteria, PeerSelectionResult, PeerCandidate } from './peer-selector.js';

// Round 16.7 — Staleness Policy
export { StalenessPolicy, DEFAULT_STALENESS_CONFIG } from './staleness-policy.js';
export type { StalenessConfig, StalenessThresholds, StalenessEvaluation, StalenessAction } from './staleness-policy.js';
