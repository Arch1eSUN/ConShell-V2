# ConShell Posture API Contract

## Overview

The Posture API exposes the agent's aggregated health and status as an externally consumable truth surface. This is the canonical data source for WebUI dashboards, TUI status views, and onboarding health checks.

## Endpoints

### `GET /api/posture` — Full Posture Snapshot

Returns complete `AgentPosture` object:

```json
{
  "agentId": "string",
  "timestamp": "ISO8601",
  "version": "string",
  "identity": {
    "mode": "genesis | restart | degraded",
    "chainValid": true,
    "chainLength": 1,
    "soulDrifted": false,
    "fingerprint": "string"
  },
  "economic": {
    "survivalTier": "thriving | stable | stressed | critical | terminal",
    "balanceCents": 50000,
    "burnRateCentsPerDay": 200,
    "runwayDays": 250,
    "profitabilityRatio": 1.5
  },
  "lineage": {
    "activeChildren": 0,
    "degradedChildren": 0,
    "totalFundingAllocated": 0,
    "totalFundingSpent": 0,
    "healthScore": 100
  },
  "collective": {
    "totalPeers": 3,
    "trustedPeers": 2,
    "degradedPeers": 0,
    "delegationSuccessRate": 0.95
  },
  "governance": {
    "pendingProposals": 0,
    "recentVerdicts": 5,
    "selfModQuarantined": false
  },
  "overallHealthScore": 92,
  "healthVerdict": "healthy | degraded | critical | terminal"
}
```

### `GET /api/posture/history` — Posture Trend Data

Returns array of historical snapshots for trend visualization.

### `GET /api/posture/health` — Quick Health Verdict

Returns minimal health-only response for lightweight polling:

```json
{
  "overallHealthScore": 92,
  "healthVerdict": "healthy",
  "timestamp": "ISO8601"
}
```

## Health Verdict Semantics

| Verdict | Score Range | Meaning |
|---------|-----------|---------|
| `healthy` | 80–100 | All subsystems nominal |
| `degraded` | 50–79 | Some subsystems impaired but operational |
| `critical` | 20–49 | Significant issues, intervention needed |
| `terminal` | 0–19 | System at risk of failure |

## `GET /api/system/summary` — Aggregated First-Screen

Combined endpoint for UI first-screen rendering. Returns agent state, posture, economic, collective, and governance summaries in one call. See [system-summary.ts](file:///Users/archiesun/Desktop/ConShellV2/packages/core/src/server/routes/system-summary.ts) for schema.
