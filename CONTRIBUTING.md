# Contributing to brigade

Thanks for wanting to help. Brigade is a Claude Code plugin — changes to it are changes
to markdown files (agents, commands, skills) and a few Node.js hooks. No compile step,
no build system.

## Project layout

```
brigade/
├── .claude-plugin/
│   ├── plugin.json          # plugin manifest (name, version, author)
│   └── marketplace.json     # marketplace declaration (this plugin is source: ./)
├── agents/                  # 14 agent definitions (markdown with YAML frontmatter)
│   ├── <role>-agent.md      # dev roles: frontend, designer, nodejs, golang, devops
│   ├── manager-agent.md     # sprint planner (opus)
│   ├── review-agent.md      # generalist reviewer
│   ├── <type>-reviewer.md   # specialist reviewers: silent-failure, test-coverage, type
│   └── <name>.md            # bug council: root-cause-analyst, code-archaeologist, ...
├── commands/                # 9 slash commands (/brigade:*)
│   └── <name>.md            # markdown with description, argument-hint, and the workflow
├── hooks/                   # 4 Node.js hooks
│   ├── hooks.json           # hook registration (SessionStart, PostToolUse, Stop)
│   ├── context-monitor.cjs  # warns agent at 35%/25% remaining context
│   ├── statusline.cjs       # model · sprint · task · dir · context bar
│   ├── setup-statusline.cjs # auto-configures project .claude/settings.json
│   └── stop-guard.cjs       # warns on exit if sprint has pending tasks
├── skills/                  # 12 bundled domain skills (no external deps)
├── presets/                 # stack presets (react × 2, nodejs × 3)
├── rules/                   # reusable rule files imported by presets
├── examples/                # reference projects showing brigade output
├── docs/                    # troubleshooting, per-command docs (WIP)
├── README.md
├── LICENSE                  # MIT
├── CHANGELOG.md             # version history
└── ROADMAP.md               # planned improvements and known gaps
```

## Development workflow

brigade has two mirrored locations:

1. **Source of truth** — `plugins/brigade/` inside the
   [claude-research](https://github.com/ushibo/claude-research) private dev repo. This
   is where we edit and test locally.
2. **Public repo** — this repository (`gigaexp/brigade`). Pushed from the source of
   truth after changes are validated.

If you want to contribute, fork `gigaexp/brigade`, make your changes, run them locally
as a plugin (see below), and open a PR against `main`.

## Running locally

### As a plugin in a test project

```bash
# In any test project directory:
claude plugin marketplace add /absolute/path/to/your/brigade/checkout
claude plugin install brigade@brigade --scope project

# Restart Claude Code to load the new version
/exit
claude
```

Edit files in your brigade checkout, then reload:

```bash
claude plugin marketplace update brigade
claude plugin update brigade@brigade --scope project
# Restart Claude Code again
```

## What makes a good contribution

### Small & focused

One PR = one change. Don't bundle a new agent with a command rewrite and a hook fix.

### Passes the dogfooding test

Whatever you add should be something brigade itself could produce. If your new feature
violates brigade's own principles (file ownership, wave isolation, failure modes in
specs, fan-out review), that's a smell.

### Real problem, not theoretical

Every new agent / command / hook must solve a concrete problem that came up in real
use. "Could be useful for X" without evidence of X is a hard sell. Reference the
sprint learnings or bug reports that motivated the change.

### Zero external dependencies

brigade is bundled — no external plugins, no npm installs, no API keys. If your change
requires something external, it belongs in its own plugin that composes with brigade.

## Anatomy of an agent

Every agent is a markdown file with YAML frontmatter. Example (`agents/foo-agent.md`):

```markdown
---
name: foo-agent
description: >
  One-line description. Triggers on keywords the orchestrator uses to decide when to
  spawn this agent. Be specific.
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
color: cyan
skills:
  - typescript-magician   # optional — references bundled skills in skills/
---

# You are a Foo Specialist

Your job is {one sentence}.

## Scope

What you own, what you don't touch.

## Process

Step-by-step approach.

## Rules

Non-negotiable constraints.
```

## Anatomy of a command

Every command is a markdown file with YAML frontmatter. Example (`commands/foo.md`):

```markdown
---
description: One-line summary of what this command does
argument-hint: "[--flag] <arg>"
---

Body describes the workflow. This markdown is the prompt the orchestrator receives
when the user runs `/brigade:foo`. Structure it as:

## Mode detection
## Preflight
## Step 1 — ...
## Step 2 — ...
## Hard rules
```

The orchestrator (top-level Claude Code session) executes these steps inline. Commands
can spawn subagents via the `Agent` tool, but they cannot directly spawn another
command.

## Task spec format

When `manager-agent` writes task specs, they follow this structure:

```yaml
---
id: S{N}.{M}
title: Short description
role: {role from ROLES.md}
status: todo
wave: {W}
depends: [S{N}.{K}, ...]
files_modify:
  - path/to/file.ts
files_no_touch:
  - path/that/belongs/to/other/task.ts
---

## Goal
1-2 sentences.

## Context
Why this task exists.

## Shared contracts
Only when 2+ parallel tasks share types/schemas. Prevents CROSS_TASK_CONTRACT_DRIFT.

## Implementation
WHAT not HOW. 5-15 bullets.

## Failure modes
3-7 specific ways this code can break. Prevents HAVE_HALTED.

## Required Tests
- Happy path test
- One regression test per failure mode above

## Acceptance Criteria
Concrete, verifiable outcomes.
```

## Fan-out review invariants

The merge gate at `/brigade:run` Step 3c spawns reviewers in parallel. When adding a new
specialist reviewer:

1. It must be **read-only** — no `Write` / `Edit` tools, only `Read`, `Glob`, `Grep`, `Bash`.
2. It must have a **single focus** — don't duplicate `review-agent`'s generalist scope.
3. It must emit a **verdict**: `APPROVE` / `REQUEST CHANGES` / `NEEDS DISCUSSION`.
4. It must write to **its own output file** under `.planning/tasks/sprint-{N}/reviews/`.
5. It must be **conditional** — spawn only when the diff actually touches its domain.

## Testing your changes

Brigade doesn't have a traditional test suite. Validation is manual:

1. Edit your change in `plugins/brigade/` (source of truth) or your brigade checkout
2. Run a full sprint on a clean test project using your modified version
3. Verify expected behavior (new agent triggers, new command works, hook fires)
4. Check `.planning/learnings.md` after the sprint — did your change introduce new patterns?

The `examples/` directory shows what a reference sprint looks like. If your change
doesn't break that output, it's probably safe.

## Versioning

brigade uses semver informally:

- **Patch** (1.8.1 → 1.8.2) — bug fixes, docs, small tweaks
- **Minor** (1.8.x → 1.9.0) — new agents, commands, behavior changes visible to users
- **Major** (1.x → 2.0) — reserved for structural changes: new task spec format,
  removed commands, breaking config migrations

Bump the version in `.claude-plugin/plugin.json` in the same commit as the code change.

## PR checklist

- [ ] Change is focused and small
- [ ] Tested locally on a real project (describe the scenario in PR body)
- [ ] No new external dependencies
- [ ] Version bumped in `plugin.json` if user-visible
- [ ] CHANGELOG.md updated
- [ ] README / docs updated if the change is user-facing
- [ ] Commit message explains the "why", not just the "what"

## License

By contributing, you agree that your contributions will be licensed under the MIT
license (see LICENSE).
