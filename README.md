<div align="center">

<img src="./logo.png" alt="brigade" width="200">

# brigade

### Your AI dev brigade for Claude Code

One chef coordinates a team of specialist agents through wave-based parallel execution,
with fan-out code review and Bug Council for hard problems. **Zero dependencies.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-orange)](https://github.com/anthropics/claude-code)
[![Version](https://img.shields.io/badge/version-1.8.3-green)](https://github.com/gigaexp/brigade/releases)
[![Stars](https://img.shields.io/github/stars/gigaexp/brigade?style=social)](https://github.com/gigaexp/brigade)

```
                                                ┌──────────────┐
                                                │  /brigade:   │
                                                │     plan     │
                                                └──────┬───────┘
                                                       ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐
│  brainstorm  │ →  │   manager    │ →  │   wave 1                 │
│  → spec      │    │   plans      │    │   ┌──────────┐ ┌───────┐ │
└──────────────┘    │   tasks      │    │   │ designer │ │ nodejs│ │
                    └──────────────┘    │   └────┬─────┘ └───┬───┘ │
                                        └────────┼───────────┼─────┘
                                                 ↓           ↓
                                        ┌────────────────────────┐
                                        │  fan-out merge gate    │
                                        │  ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐  │
                                        │  │R│ │S│ │T│ │D│ │V│  │
                                        │  └─┘ └─┘ └─┘ └─┘ └─┘  │
                                        └──────────┬─────────────┘
                                                   ↓
                                            wave 2 → ... → ship
```

[Install](#install) · [Quick start](#quick-start-existing-project) · [How it works](#how-a-sprint-actually-runs) · [Commands](#commands) · [Examples](./examples) · [Roadmap](./ROADMAP.md)

</div>

---

## Why brigade

- **Specialists, not generalists.** 5 dev roles (frontend, designer, nodejs, golang, devops),
  each with its own domain expertise and isolated file ownership.
- **Wave-based parallel execution.** Workers run in `git worktree` isolation — no race
  conditions, no merge conflicts, no stomping on each other's files.
- **Fan-out code review.** Every merge gate spawns 5 reviewers in parallel: generalist,
  silent-failure hunter, test-coverage analyst, type-design reviewer, and (if UI changed)
  visual reviewer. Catches bugs the generalist alone misses.
- **Bug Council for hard problems.** When a fix fails 3+ times, 5 diagnostic agents spawn
  in parallel (root cause, code archaeologist, pattern matcher, systems thinker, adversarial
  tester) and synthesize findings into a single root cause.
- **Sprint learnings.** After each sprint, brigade detects patterns (HIGH_REVIEW_ROUNDS,
  CROSS_TASK_CONTRACT_DRIFT, MODEL_ESCALATION...) and writes them to `.planning/learnings.md`.
  The next sprint's planner reads this and avoids repeating the same mistakes.
- **Zero dependencies.** Everything is bundled — 12 domain skills, 14 agents, 9 commands.
  No external plugins required, no skill installation, no setup ceremony.

## What makes brigade different

Compared to other multi-agent Claude Code plugins:

| Feature | brigade | DevTeam | TeamClaude | oh-my-claudecode |
|---|---|---|---|---|
| Worker isolation via git worktrees | ✅ enforced | ✅ | ✅ | ✅ advisory |
| File ownership per task (`files_modify`) | ✅ | partial | — | — |
| Fan-out code review (5 specialists in parallel) | ✅ | language-specific only | single reviewer | factcheck only |
| Bug Council for hard bugs | ✅ 5 diagnosticians | ✅ 5 agents | — | — |
| Sprint learnings between iterations | ✅ | — | ✅ retrospectives | — |
| Designer role with visual review | ✅ | — | — | — |
| Model escalation (haiku → sonnet → opus) | ✅ | ✅ | ✅ | — |
| Zero external dependencies | ✅ | ✅ | — | partial |
| Commands count | 9 | 21 | 1 | ~1 |
| Agents count | 14 | 127 | 7 | 18 |

**brigade philosophy:** quality over quantity. Five specialists who know their craft beat
127 agents who all do everything. Ship one well-reviewed feature instead of three flaky ones.

## Install

Add the marketplace, then install the plugin:

```bash
# Add brigade marketplace (one-time)
claude plugin marketplace add gigaexp/brigade

# Install in current project
claude plugin install brigade@gigaexp --scope project
```

Or globally:

```bash
claude plugin install brigade@gigaexp --scope user
```

After install, restart Claude Code (`/exit` and reopen) so the new commands and hooks load.

## Quick start (existing project)

```
cd ~/your/project

# 1. Pick which roles you need (frontend, designer, nodejs, golang, devops)
/brigade:init

# 2. Map the codebase so the planner knows what's there
/brigade:onboard

# 3. Plan a feature — brainstorm → design → sprint tasks
/brigade:plan "add SSO with OAuth"

# 4. Execute the sprint wave by wave
/brigade:run

# 5. (Anytime) See what's happening
/brigade:status
```

## Quick start (greenfield)

```
mkdir my-new-project && cd my-new-project
git init
/brigade:init                       # pick roles + presets
/brigade:plan "URL shortener app"   # brainstorm → spec → tasks
/brigade:run                        # ship
```

## Bug fixes

```bash
/brigade:fix "checkout fails on empty cart"
```

Fast path — skips brainstorming, creates a minimal sprint with a regression test mandatory.

If the same bug fails 3+ times, brigade auto-escalates to the Bug Council:

```bash
/brigade:bug-council "race condition in click counter"
```

5 diagnostic specialists analyze in parallel, synthesize into a single root cause + fix
recommendation. Never auto-applies — you read the synthesis and decide.

## Commands

| Command | What it does |
|---|---|
| `/brigade:init` | Bootstrap: pick roles, configure stacks, write CLAUDE.md + ROLES.md |
| `/brigade:onboard` | Scan an existing codebase → `.planning/ARCHITECTURE.md` |
| `/brigade:plan <feature>` | Brainstorm design → manager creates task specs with waves |
| `/brigade:plan @file.md` | Skip design phase, use existing spec file as input |
| `/brigade:fix <bug>` | Fast-path for bugs: minimal sprint, regression tests mandatory |
| `/brigade:bug-council <bug>` | Spawn 5 diagnostic specialists in parallel |
| `/brigade:run` | Execute the current sprint wave by wave with fan-out review gate |
| `/brigade:resume` | Continue an interrupted sprint (5 scenarios auto-detected) |
| `/brigade:status` | Read-only dashboard: progress, waves, learnings, next action |
| `/brigade:version` | Print installed version |

## The roles

### Development (5)

- **frontend-agent** — React/Vue/Svelte app logic, routing, state, data fetching, forms
- **designer-agent** — UI/UX, design tokens, styled components, visual direction, visual review
- **nodejs-agent** — Node.js services, APIs, Fastify/Express/NestJS
- **golang-agent** — Go services, CLI tools, microservices
- **devops-agent** — CI/CD, Kubernetes, Terraform, cloud platforms

### Sprint orchestration (auto-managed)

- **manager-agent** — sprint planner, decomposes goals into task specs with waves
- **review-agent** — generalist code reviewer at merge gate

### Specialist reviewers (auto-spawned at merge gate)

- **silent-failure-reviewer** — catches swallowed errors, unsafe fallbacks, broad catches
- **test-coverage-reviewer** — test gaps, weak assertions, missing edge cases
- **type-reviewer** — type safety, encapsulation, loose `any`/`unknown` usage
- **designer-agent** in review mode — generic AI slop detection, design system consistency

### Bug Council (auto-spawned by `/brigade:fix` after 3+ failures or `/brigade:bug-council`)

- **root-cause-analyst** — 4-phase systematic debugging, trace to source
- **code-archaeologist** — git history, when was this introduced, Chesterton's fence
- **pattern-matcher** — similar bugs elsewhere, working examples, fix scope
- **systems-thinker** — coupling, data flow, invariants, blast radius
- **adversarial-tester** — edge cases, assumptions the fix makes, regression risk

## How a sprint actually runs

```
/brigade:plan "add user notifications"

  Phase 1 — Design
    ├─ Read ARCHITECTURE.md, ROLES.md, recent commits
    ├─ Ask 3-5 clarifying questions (one at a time)
    ├─ Propose 2-3 approaches with trade-offs
    ├─ Present design in sections, get approval
    └─ Write .planning/specs/2026-04-13-notifications.md

  HARD GATE: no sprint planning until user approves design

  Phase 2 — Sprint planning (manager-agent)
    ├─ Read design doc + ROLES.md + ARCHITECTURE.md + learnings.md
    ├─ Decompose into atomic tasks (≤5-7 files each)
    ├─ Each task: files_modify, files_no_touch, Shared contracts,
    │            Failure modes, Required Tests, Acceptance Criteria
    ├─ Build file map, detect conflicts
    └─ Assign waves (no file overlap inside a wave)

/brigade:run

  Wave 1 (parallel)
    ├─ Spawn ALL workers in one message (parallel)
    │   Each in isolated git worktree
    │   Model selected by task complexity
    ├─ Workers: implement → test → commit → "done"
    ├─ Merge branches sequentially (no-ff)
    ├─ Run full test suite — halt on failure
    ├─ Fan-out merge gate (parallel review):
    │   ├─ review-agent (generalist)
    │   ├─ silent-failure-reviewer (if catch/try in diff)
    │   ├─ test-coverage-reviewer (if test files in diff)
    │   ├─ type-reviewer (if new types in diff)
    │   └─ designer-agent (if styles/UI in diff)
    ├─ Aggregate verdict — halt on critical findings
    ├─ Pattern sweep (only on fix waves) — catches similar bugs elsewhere
    └─ Update task statuses → done, commit

  Wave 2 (parallel) — depends on wave 1
    ...

  Sprint complete
    ├─ Final test run
    ├─ Generate sprint learnings → .planning/learnings.md
    │   Detect: HIGH_REVIEW_ROUNDS, MODEL_ESCALATION, TASK_BLOCKED,
    │           WAVE_HALTED, LOW_COMPLETION_RATE, FILE_OVERLAP_CONFLICT,
    │           CROSS_TASK_CONTRACT_DRIFT, HAVE_HALTED
    └─ Suggest: open PR (already passed 5-reviewer gate)
```

## File layout

After running brigade on a project, you'll find:

```
your-project/
├── CLAUDE.md                       ← @-imports brigade rules
└── .planning/
    ├── ARCHITECTURE.md             ← from /brigade:onboard
    ├── learnings.md                ← sprint retrospectives
    ├── specs/                      ← design docs
    │   └── 2026-04-13-feature.md
    ├── tasks/
    │   ├── ROLES.md                ← role → agent mapping (editable)
    │   └── sprint-N/
    │       ├── _README.md          ← sprint overview, waves, file map
    │       ├── S{N}.{M}-slug.md    ← task specs
    │       └── reviews/            ← merge gate reports
    └── bug-council/                ← from /brigade:bug-council
        └── {timestamp}/
            ├── root-cause.md
            ├── archaeology.md
            ├── patterns.md
            ├── systems.md
            ├── adversarial.md
            └── synthesis.md
```

## Agent overrides

`.planning/tasks/ROLES.md` maps project roles to agents. Edit the `agent:` field to use:
- A custom project agent in `.claude/agents/<name>.md`
- An agent from another plugin (`some-plugin:agent-name`)
- Any built-in brigade agent

`/brigade:run` will spawn whatever you put there.

## Presets

Stack-specific rule files that get imported into your project's `CLAUDE.md` during `/brigade:init`:

| Preset | For |
|---|---|
| `react-mobx-strict` | React + MobX with presenter/container split, i18n, tests |
| `react-basic` | React with mandatory i18n + tests, no state-manager opinion |
| `nodejs-fastify` | Fastify plugin architecture, JSON Schema, pino, inject testing |
| `nodejs-express` | Express router structure, middleware chain, supertest |
| `nodejs-nestjs` | NestJS modules, DTOs, class-validator, DI, guards |

## Bundled skills

12 domain skills bundled inside the plugin — no installation required:

`i18n`, `typescript-magician`, `frontend-design`, `golang-pro`, `node`, `nodejs-core`,
`fastify-best-practices`, `kubernetes-architect`, `devops-flow`, `infra-engineer`

## Hooks

- **context-monitor** — warns the agent when context drops below 35% (warning) or 25% (critical)
- **statusline** — model · sprint · current task · directory · context bar
- **setup-statusline** — auto-configures project statusline on session start
- **stop-guard** — warns if you try to exit while sprint has pending tasks

## Philosophy

brigade is built for solo developers and small teams who want to ship real products with
AI agents without giving up rigor. Three principles:

1. **Specialists beat generalists.** A frontend agent that knows React deeply produces
   better code than a "general dev" agent that knows everything shallow. Same for designer,
   nodejs, devops.

2. **Parallel review beats single review.** A generalist reviewer misses class-specific
   bugs. Five reviewers in parallel — generalist + silent-failure + test-coverage +
   type-design + visual — catch what one would miss.

3. **The system should learn.** brigade detects what went wrong in each sprint and
   feeds that knowledge to the next sprint's planner. You shouldn't repeat the same
   mistakes across iterations.

## Status

Pre-1.0 in the public sense — battle-tested in private use, ready for early adopters who
want to try a new approach to AI-assisted development. Bug reports and feedback welcome.

## License

MIT
