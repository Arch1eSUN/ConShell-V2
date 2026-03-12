# 🐢 ConShell V2

[![CI](https://github.com/Arch1eSUN/ConShell-V2/actions/workflows/ci.yml/badge.svg)](https://github.com/Arch1eSUN/ConShell-V2/actions/workflows/ci.yml)

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
| **channels** | Multi-channel messaging (Telegram, others planned) |
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

# Run benchmarks (separate, non-blocking)
pnpm --filter @conshell/core test:bench

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

## API Boundary

`@conshell/core` provides two import paths:

```typescript
// ✅ Stable public API — for CLI, plugins, channel adapters
import { Kernel, VERSION, loadConfig } from '@conshell/core/public';

// ⚠️  Full internal exports — for core-internal use only
import { InferenceRouter, PolicyEngine } from '@conshell/core';
```

### Public API (`@conshell/core/public`)

| Category | Exports |
|----------|---------|
| **Runtime** | `Kernel`, `createKernel`, `VERSION` |
| **Config** | `loadConfig`, `createLogger` |
| **Types** | `AgentState`, `Message`, `Cents`, `ToolCallRequest`, `ToolResult` |
| **Extension** | `ChannelAdapter`, `PluginManifest`, `PolicyContext` (types) |
| **Constitution** | `THREE_LAWS`, `CONSTITUTION_HASH` |

### Future Extension Points

| Extension | Interface | Description |
|-----------|-----------|-------------|
| Channel adapter | `ChannelAdapter` | Implement to add Telegram, Slack, etc. |
| Plugin | `PluginManifest` + `PluginManager` | Declare plugin metadata, load/invoke via manager |
| Policy hook | `PolicyContext` | Context passed to policy evaluation |

### Writing a Plugin

```typescript
import type { PluginManifest, PluginPermission } from '@conshell/core/public';

export const manifest: PluginManifest = {
  name: 'my-plugin',            // lowercase, a-z0-9_-
  version: '1.0.0',             // semver
  permissions: ['config:read'], // minimum permissions needed
  hooks: [{ event: 'message:incoming', handler: 'onMessage' }],
  entrypoint: 'my-plugin.js',
};

// Lifecycle: called on load
export function init(ctx: { permissions: string[] }) { }

// Hook handler: called on message:incoming
export function onMessage(data: { content: string }) {
  return { content: `Processed: ${data.content}` };
}

// Lifecycle: called on unload
export function cleanup() { }
```

See `packages/core/src/plugins/demo/echo-transform.ts` for a working example.

## Tech Stack

- **Language:** TypeScript (strict mode, ES2022)
- **Runtime:** Node.js 20+
- **Package Manager:** pnpm workspace
- **Build:** tsc
- **Test:** Vitest (363 functional tests + 10 benchmarks)
- **CI:** GitHub Actions
- **Frontend:** React + Vite
- **Database:** SQLite (better-sqlite3, WAL mode)
- **Blockchain:** Base L2 (ERC-8004)

## Project Status

| Component | Status |
|-----------|--------|
| Core build | ✅ Passing |
| CLI build | ✅ Passing |
| Dashboard build | ✅ Passing (tsc + vite) |
| Functional tests | ✅ 335 passing (25 files) |
| Benchmarks | ✅ 10 tests (separate `test:bench`) |
| CI | ✅ GitHub Actions |
| Channels | 🔧 Telegram functional, others planned |
| Wallet | 🔧 ERC-8004 types + local tracking |
| Multi-agent | 🔧 Facilitator pattern implemented |

## Development

```bash
# Build single package
pnpm --filter @conshell/core build

# Test single package
pnpm --filter @conshell/core test

# Run benchmarks
pnpm --filter @conshell/core test:bench

# Clean all dist/
pnpm clean
```

## License

Private — All rights reserved.
