# AGENT_START_HERE

> 用途：给任何未来参与 ConShell 开发的 agent 一个固定、强约束、不可跳过的起点。  
> 原则：先理解项目目的与当前现实，再做当轮次开发。禁止脱离审计结果直接规划下一轮。

---

# 1. Before You Touch Code

If you are an agent working on ConShell, do **not** start implementation immediately.

You must first understand:

1. what the project actually is
2. what the current global audit says
3. what the global development plan is
4. what the current next-phase roadmap is
5. what the upstream alignment gaps are
6. what the current round already completed

If you skip this, you are likely to:
- downgrade the project into a normal app
- plan from stale assumptions
- duplicate resolved work
- expand the wrong surface
- confuse module presence with system closure

---

# 2. Mandatory Reading Order

Read the following files in exactly this order before proposing or performing meaningful development work:

1. `docs/project/PROJECT_PURPOSE_AND_GLOBAL_OBJECTIVE.md`
2. `docs/audit/GLOBAL_AUDIT_2026-03-14.md`
3. `docs/planning/GLOBAL_DEVELOPMENT_PLAN.md`
4. `docs/planning/NEXT_PHASE_ROADMAP.md`
5. `docs/project/UPSTREAM_ALIGNMENT_AND_GAP_ANALYSIS.md`
6. `CONSTITUTION.md`
7. `docs/audit/DEVLOG.md`
8. `README.md`

Only after reading these should you move on to module-specific files.

---

# 3. How to Choose the Next Round of Work

The next round must be chosen from:

- the current round’s implemented state
- the current round’s verification evidence
- the current round’s audit conclusion
- the roadmap phase / priority / dependency structure

The next round must **not** be chosen from:

- old README wording
- vague ambition without current evidence
- upstream repo README alone
- unverified assumptions about project status

---

# 4. Project Framing Rules

You must treat ConShell as:

> a Web4-oriented autonomous AI lifeform runtime project

You must **not** reduce it to:
- a chat app
- a dashboard app
- a CLI wrapper
- a generic sovereign bot
- a random monorepo with agent features

This rule is mandatory.

---

# 5. Development Discipline Rules

## Rule 1 — Reality first
No implementation claim without evidence.

## Rule 2 — Current round first
Every next-round plan must begin from the current round’s end-state.

## Rule 3 — Closure over breadth
Prefer closing identity / memory / economy / governance / replication loops over adding superficial breadth.

## Rule 4 — Upstream principles over feature copying
Absorb OpenClaw and Automaton system strengths, not their feature lists mechanically.

## Rule 5 — Preserve runtime truth
Doctor / viability / evidence integrity must not be weakened for convenience.

---

# 6. Required Output Pattern for Future Rounds

Before implementation, the agent should produce:

## A. Current Round Baseline
- what is already true
- what was verified
- what remains open

## B. Chosen Next-Round Scope
- what exact problem this round solves
- why it is the highest-leverage next move
- which roadmap phase / priority it belongs to

## C. Dependency Check
- what this round depends on
- whether those dependencies are actually satisfied

## D. Success Criteria
- what commands / tests / evidence will prove completion

After implementation, the agent should produce:

## E. Verification
- what was actually run
- actual results
- failures included

## F. Audit Conclusion
- what changed in reality
- what remains incomplete
- what the next round should now be

---

# 7. If Human Manual Action Is Needed

If system protection / SIP / sandbox / host constraints require a human to run commands:

- clearly label it as manual action
- provide exact command(s)
- explain purpose
- explain expected result
- explain how you will verify after the human runs it

Never write manual-required steps as already completed.

---

# 8. One-Line Reminder

> **ConShell only advances when each round begins from audited reality and ends with a new audited reality.**
