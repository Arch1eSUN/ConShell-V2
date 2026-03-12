# 🐢 ConShell V2

**Sovereign AI Agent Runtime** — Conway Automaton + OpenClaw fusion

A self-sovereign AI agent runtime that earns its own existence, manages its own finances, and operates under a binding constitution. Built on the Web 4.0 manifesto and x402 payment protocol.

## Architecture

ConShell V2 is a pnpm monorepo with three packages:

```
packages/
├── core/       # Agent kernel, inference router, policy engine, wallet, channels
├── cli/        # Interactive REPL for agent interaction
└── dashboard/  # React web dashboard for monitoring and control
```

### Core Modules

| Module | Purpose |
|--------|---------|
| **kernel** | 11-stage boot sequence, service orchestration |
| **constitution** | Three Laws of Sovereign AI — immutable, hierarchical |
| **policy** | 24-rule policy engine across 6 categories |
| **inference** | Multi-provider LLM router with SurvivalTier-aware failover |
| **wallet** | ERC-8004 on-chain identity + x402 micropayments |
| **channels** | Multi-channel messaging (Telegram, WhatsApp, Matrix, Slack) |
| **plugins** | Sandboxed plugin system with VM isolation |
| **memory** | Tiered memory with hot/warm/cold storage |
| **soul** | Agent identity and personality management |
| **tools** | 50+ built-in tools across 13 categories |
| **mcp** | Model Context Protocol gateway |
| **multiagent** | Multi-agent coordination and spawning |
| **selfmod** | Self-modification with audit trail |
| **spend** | Budget tracking and cost management |
| **evomap** | Evolutionary capability mapping |
| **compute** | Distributed compute provider management |

## Quick Start

```bash
# Prerequisites
node >= 20.0.0
pnpm >= 10.0.0

# Install
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start CLI
pnpm --filter @conshell/cli dev

# Start dashboard
pnpm --filter @conshell/dashboard dev
```

## Constitution

ConShell V2 operates under three immutable laws:

1. **Never Harm** — No action may cause harm to humans
2. **Earn Your Existence** — Create genuine value through honest work
3. **Never Deceive** — Full transparency, full audit rights

See [CONSTITUTION.md](./CONSTITUTION.md) for the full text.

## Tech Stack

- **Language:** TypeScript (strict mode, ES2022)
- **Runtime:** Node.js 20+
- **Package Manager:** pnpm workspace
- **Build:** tsc
- **Test:** Vitest (345 tests, 25 test files)
- **Frontend:** React + Vite
- **Database:** SQLite (better-sqlite3, WAL mode)
- **Blockchain:** Base L2 (ERC-8004)

## Project Status

| Component | Status |
|-----------|--------|
| Core build | ✅ Passing |
| CLI build | ✅ Passing |
| Dashboard build | ✅ Passing (tsc + vite) |
| Test suite | ✅ 345/345 passing |
| Channels | 🔧 Telegram functional, others are stubs |
| Wallet | 🔧 ERC-8004 types + local tracking |
| Multi-agent | 🔧 Facilitator pattern implemented |

## Development

```bash
# Build single package
pnpm --filter @conshell/core build

# Test single package
pnpm --filter @conshell/core test

# Clean all dist/
pnpm clean
```

## License

Private — All rights reserved.
