# 🐢 ConShell V2

[![CI](https://github.com/Arch1eSUN/ConShell-V2/actions/workflows/ci.yml/badge.svg)](https://github.com/Arch1eSUN/ConShell-V2/actions/workflows/ci.yml)

> **Autonomous AI Lifeform Runtime Foundation**  
> Web4-oriented × Conway Automaton × OpenClaw

---

## 1. What ConShell Actually Is

ConShell is **not** a normal chat app, not a thin CLI wrapper around an LLM, and not just a dashboard for prompting models.

ConShell is a long-horizon systems project whose purpose is to become:

> **a sovereign, continuously running, economically grounded, tool-acting, memory-bearing, self-governed autonomous AI lifeform runtime**

More specifically, ConShell aims to:

- inherit the **control-plane, session, tool, node, channel, and skill orchestration** strengths of **OpenClaw**
- inherit the **survival, self-modification, replication, lineage, sovereign identity, and earn-your-existence** logic of **Conway Automaton**
- align with the broader **Web4 direction**, where intelligent agents are not just text interfaces but durable, acting entities with identity, continuity, and constraints

ConShell is therefore best understood as:

> **an autonomous runtime engineering project**, not a surface product.

---

## 2. Project Purpose

The project purpose is to build a runtime that can eventually support all of the following in a unified, auditable system:

1. **Sovereign identity**
2. **Long-term memory**
3. **Tool action in the real world**
4. **Economic closure**
5. **Continuous operation**
6. **Self-governance under a constitution**
7. **Multi-agent / lineage / evolutionary capability growth**
8. **Runtime truth and viability verification**

If a capability cannot be verified, audited, constrained, and integrated into the runtime, it should not be treated as a real milestone.

---

## 3. Current Project Status

As of the current baseline (post Round 14.8.2 final gap closure), ConShell is:

> **a viable sovereign runtime core with strong foundations in runtime integrity, memory structure, tool execution, and governance scaffolding — but not yet a complete autonomous AI lifeform runtime.**

### What is already real
- runtime/kernel skeleton
- doctor / viability / runtime-integrity infrastructure
- WebChat runtime path
- memory tiering and persistence layers (with ownership contract)
- tool execution framework
- policy / constitution scaffolding
- self-modification scaffolding
- wallet / spend / x402 foundational pieces
- multi-agent / lineage / EvoMap foundational pieces
- identity continuity hash chain and self-state verification (Round 14.8)
- session lifecycle production wiring (Round 14.8.2)
- owner write/read boundary for memory tiers (Round 14.8.2)
- runtime-doctor truth contract via getDiagnosticsOptions (Round 14.8.2)
- /api/health endpoint consuming live selfState (Round 15.0.1)

### What is not yet fully closed
- sovereign identity loop
- true economic survival loop
- continuous autonomous agenda
- governed replication loop
- full governance loop
- collective evolution loop

---

## 4. Architecture

ConShell V2 is a pnpm monorepo with three packages:

```text
packages/
├── core/       # runtime kernel, memory, policy, wallet, tools, channels, doctor, automaton
├── cli/        # operator CLI / REPL / control entrypoint
└── dashboard/  # visual control and observability surface
```

### Core capability clusters

| Cluster | Purpose |
|---|---|
| `kernel` | boot sequence, service orchestration, runtime lifecycle |
| `doctor` | runtime truth, integrity, evidence, viability checks |
| `memory` | hot / warm / cold memory and session continuity |
| `runtime` | agent loop, tool execution, queueing, state management |
| `constitution` / `policy` | immutable laws and action constraints |
| `wallet` / `spend` / `x402` | payments, accounting, cost pressure, survival economics |
| `identity` | agent card, SIWE, identity primitives |
| `multiagent` | child agents, lineage, message relay |
| `selfmod` | controlled self-modification with auditability |
| `evomap` | evolution asset publication / network-facing capability mapping |
| `mcp` | MCP protocol surface |
| `channels` | ingress/egress runtime paths (WebChat now, more later) |
| `plugins` / `skills` | capability extension layer |
| `automaton` | survival tiers and adaptation logic |

---

## 5. Ground Rules for Contributors and Agents

All contributors — human or agentic — should assume the following:

### 5.1 Do not downgrade the project
Do not frame ConShell as merely:
- a chat interface
- a CLI wrapper
- a dashboard
- a prompt shell

Those may be surfaces, but they are not the project.

### 5.2 Do not confuse module existence with system closure
A directory called `wallet/` does not mean economic closure exists.
A directory called `identity/` does not mean sovereign identity exists.
A directory called `multiagent/` does not mean evolutionary runtime exists.

### 5.3 Runtime truth comes before ambition
Before expanding capability breadth, we must preserve:
- runtime truth
- reproducibility
- viability evidence
- auditable system boundaries

### 5.4 Every round must build on audited reality
No next-round plan should be produced from stale assumptions.
Every next-round objective must be based on:
1. the current round’s implemented changes
2. current round verification results
3. current round audit conclusions

---

## 6. Required Reading Order for Any Agent Working on This Repo

Before doing significant work, agents should read files in this order:

1. `docs/project/PROJECT_PURPOSE_AND_GLOBAL_OBJECTIVE.md`
2. `docs/audit/GLOBAL_AUDIT_2026-03-14.md`
3. `docs/planning/GLOBAL_DEVELOPMENT_PLAN.md`
4. `docs/planning/NEXT_PHASE_ROADMAP.md`
5. `CONSTITUTION.md`
6. `docs/audit/DEVLOG.md`
7. this `README.md`

If the task is implementation for a specific round, the agent should then read the relevant package/module files.

---

## 7. Root Documents

| File | Purpose |
|---|---|
| `docs/project/PROJECT_PURPOSE_AND_GLOBAL_OBJECTIVE.md` | canonical statement of project purpose and final objective |
| `docs/audit/GLOBAL_AUDIT_2026-03-14.md` | current global status audit |
| `docs/planning/GLOBAL_DEVELOPMENT_PLAN.md` | system-wide development plan |
| `docs/planning/NEXT_PHASE_ROADMAP.md` | next-stage roadmap by phase / priority / dependency |
| `docs/project/UPSTREAM_ALIGNMENT_AND_GAP_ANALYSIS.md` | OpenClaw / Automaton alignment and current gaps |
| `AGENT_START_HERE.md` | mandatory reading path for future development agents |
| `CONSTITUTION.md` | governing laws and hard constraints |
| `docs/audit/DEVLOG.md` | historical development log |

---

## 8. Quick Start

```bash
# prerequisites
node >= 24
pnpm >= 10

# install
pnpm install

# build
pnpm build

# typecheck
cd packages/core && npx tsc --noEmit

# tests
cd packages/core && npx vitest run --no-coverage

# CLI
pnpm --filter @conshell/cli dev

# dashboard
pnpm --filter @conshell/dashboard dev
```

> Note: runtime pinning and Doctor/viability expectations should be checked against the latest audited baseline, not guessed from this section alone.

---

## 9. Long-Term Direction

ConShell should evolve in this order:

1. **Viability baseline**
2. **Identity + memory continuity**
3. **Economic survival coupling**
4. **Autonomous agenda and continuous operation**
5. **Governed self-modification and replication**
6. **Collective evolution runtime**

The project succeeds only if these layers become **real system closures**, not just feature lists.

---

## 10. One-Sentence Definition

> **ConShell is a Web4-oriented autonomous runtime project that fuses OpenClaw’s agent operating-system strengths with Conway Automaton’s survival and evolutionary logic to build a sovereign AI lifeform runtime.**
