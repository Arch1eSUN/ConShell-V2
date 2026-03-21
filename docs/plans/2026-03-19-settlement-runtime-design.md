# Round 18.0 Settlement Runtime Design: Decoupled & Asynchronous Architecture

## 1. Overview
Round 18.0 advances ConShell's payment capabilities from "Payment Negotiation & Preparation" (Round 17.9) into a complete, closed-loop **Settlement Execution & Revenue Realization Runtime**. The priority is to execute settlements, verify receipts, and adopt them into a canonical economic ledger, while strictly maintaining the human confirmation, mandate, policy, and firewall boundaries.

We have adopted **Option A (Decoupled & Asynchronous Verification)** to ensure maximum security against provider credential spoofing and to prepare for long-latency (e.g., on-chain) settlements in the future.

## 2. Core Architecture

The architecture separates the runtime into three distinct stages: Execution, Verification, and Ledger Adoption.

### Stage 1: Settlement Execution Layer
- **Component**: `SettlementExecutor` / `ProviderExecutionAdapter`
- **Responsibility**: Submits the `PaymentPreparationIntent` to external providers (e.g., Stripe, Coinbase, or an internal mock). 
- **Output**: Returns a `SettlementReceipt` (which can be `success`, `pending`, or `failed`).
- **Safety Gate**: Before submission, the engine verifies that the required human confirmation (if any) was granted and that the mandate hasn't expired. Repeated execution attempts on a stale intent are blocked.

### Stage 2: Verification Layer
- **Component**: `PaymentVerifier`
- **Responsibility**: Acts as a cryptographic or procedural firewall strictly for receipts.
- **Rules**:
  - Verifies that the receipt originates from the correct provider.
  - Matches the `amountCents` and `asset` exactly against the original negotiation.
  - Checks for duplicate receipt submission (`receipt_duplicate`).
  - Verifies the expiration boundaries.
- **Output**: A structured `SettlementVerificationResult` (e.g., `verified_success`, `receipt_invalid`, `mismatch`, `inconclusive`).

### Stage 3: Canonical Ledger Adoption & Revenue Realization
- **Component**: `CanonicalEconomicLedger` & `RevenueRealizationEngine`
- **Responsibility**: Absorbs **only** `verified_success` receipts into the unified ledger.
- **Ledger Entries**: Creates `IncomeLedgerEntry` or `SpendLedgerEntry`.
- **Value Loop**: Updates the profitability attribution mapping to tasks, linking the financial outcome back to the core ConShell agenda and survival heuristics.

## 3. Data Entities

- **`SettlementExecutionRequest`**: Represents the final go-decision. Includes negotiationId, selectedOffer, providerId, riskLevel.
- **`SettlementReceipt`**: Contains the provider's transaction hash or confirmation ID, amount, and timestamp.
- **`SettlementVerificationResult`**: Contains the verification verdict.
- **`CanonicalLedgerEntry`**: Immutable record of adopted economic transfer.

## 4. State Machine (Settlement Lifecycle)
`planned` -> `awaiting_human_confirmation` -> `authorized_for_execution` -> `submitted` -> `proof_pending` -> `verified` -> `adopted_into_ledger`.

Failure paths: `failed`, `rejected`, `expired`, `receipt_invalid`.

## 5. Security Invariants
- `explicit_transfer` actions ALWAYS require human confirmation. Execution cannot be triggered automatically for these actions.
- The Ledger will NEVER adopt a receipt that has not passed the `PaymentVerifier`.
- Provider Execution Adapters have NO permission to mutate the Ledger directly.

## 6. Truth Surface & API
The operator will be able to query:
- `/api/economic/settlements/pending` (Executions submitted but waiting for proof/verification).
- `/api/economic/settlements/verification` (Recent verification results and failures).
- `/api/economic/revenue` (Realized income/spend adopted into the ledger).
