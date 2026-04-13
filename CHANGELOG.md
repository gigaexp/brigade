# Changelog

All notable changes to brigade.

## 1.3.0 — 2026-04-13

Implements all remaining learnings from sprint 1 url-shortener test.

### Fixed

- **WORKER_CHECKOUT_IN_MAIN_TREE** — workers were branching in main tree instead of
  isolated worktrees during fix waves and model escalation retries. `/brigade:run` now
  enforces `isolation: "worktree"` on every Agent call, with explicit verification step
  before each spawn. Hard rule added.
- **DEFERRED_DEBT_ACCRETION** — manager-agent now sweeps `.planning/learnings.md` for
  unresolved deferred debt during planning and either bundles it into current sprint
  tasks or surfaces it explicitly in `_README.md`. Prevents items from piling up forever.
- **FIX_WAVES_INTRODUCE_NEW_ISSUES** — `/brigade:run` now spawns `pattern-matcher` after
  every fix wave to scan the codebase for similar bugs the targeted fix might have missed.
  Fix waves no longer leave class-of-bug debt behind.

### Added

- LICENSE (MIT)
- CHANGELOG.md

### Documentation

- README rewritten for public audience: hook, comparison table vs competitors,
  philosophy, install instructions, walkthrough of how a sprint runs

## 1.2.0 — 2026-04-13

Three fixes from real sprint 1 test on url-shortener.

### Fixed

- **`/brigade:plan` preflight** — now checks for `.planning/ARCHITECTURE.md` on existing
  projects and offers to run `/brigade:onboard` first. Previously planned blind.
- **`/brigade:plan @file.md`** — now prints explicit notice that design phase is being
  skipped and explains how to brainstorm instead. Previously silent.

### Added

- **Shared contracts** section in task spec template (manager-agent). Mandatory when
  parallel tasks share types or schemas. Fixes `CROSS_TASK_CONTRACT_DRIFT` learning.
- **Failure modes** section in task spec template. Mandatory for non-trivial logic.
  Required Tests now maps 1:1 to failure modes. Fixes `HAVE_HALTED` (3 of 4 waves halted
  on bugs the worker self-audit missed).

## 1.1.1 — 2026-04-13

### Fixed

- Removed external command suggestions from sprint completion text in
  `/brigade:run`, `/brigade:status`, and `/brigade:resume`. They were suggesting
  `/code-review` (external pr-review-toolkit dependency) and the LLM hallucinated
  `/brigade:review-pr`. brigade is zero-dependency and the 5-reviewer fan-out merge
  gate already covers everything.

## 1.1.0 — 2026-04-13

### Added

- `/brigade:resume` — auto-detects sprint state and continues from the right place.
  Five scenarios: status drift sync, outstanding branches merge, clean state with
  pending wave, sprint complete, conflicting state.

### Removed

- `/brigade:merge` — replaced by `/brigade:resume` which covers the same use case
  plus four others.

## 1.0.3 — 2026-04-13

### Changed

- Renamed `/brigade:map` → `/brigade:onboard`. The new name reads naturally as the
  brownfield counterpart to `/brigade:init` (greenfield setup).

### Removed

- `/brigade:doctor` — was a leftover from when external skill dependencies existed.
  Now that everything is bundled, it just printed "all bundled" every time.

## 1.0.2 — 2026-04-13

### Changed

- `/brigade:init` now offers only 5 dev roles. `review` is auto-included when any dev
  role is picked (was duplicated as a manual option). `content` removed entirely
  (brigade focuses on code).

### Removed

- `agents/content-agent.md`
- `skills/content-creator/`

## 1.0.1 — 2026-04-12

### Added

- `/brigade:status` — read-only dashboard showing current sprint progress, per-task
  state with icons, wave verdicts, learnings carry-over, blocked tasks, next action
  suggestion, global stats.

## 1.0.0 — 2026-04-12

First public release. Renamed from `dev` to `brigade`, inspired by the kitchen brigade
de cuisine where a chef coordinates specialists at each station.

### Highlights

- 14 agents: 5 dev roles (frontend, designer, nodejs, golang, devops), manager,
  generalist reviewer, 3 specialist reviewers (silent-failure, test-coverage, type),
  5 Bug Council diagnosticians (root-cause, archaeologist, pattern-matcher,
  systems-thinker, adversarial-tester)
- 9 commands: init, onboard, plan, fix, bug-council, run, resume, status, version
- 12 bundled domain skills (zero external dependencies)
- 5 stack presets (react × 2, nodejs × 3)
- 4 hooks (context-monitor, statusline, setup-statusline, stop-guard)
- Sprint learnings between iterations
- Model escalation (haiku → sonnet → opus on failure)
- Designer/frontend role split with visual review
- File ownership enforcement via `files_modify` / `files_no_touch`
- Worktree isolation for parallel workers
