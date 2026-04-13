---
description: Bootstrap a project for the brigade plugin — pick roles, configure each, write CLAUDE.md and .planning/tasks/
---

You are bootstrapping the `brigade` plugin for the user's current project. This is the
single entry point for setup: role selection, stack configuration, rule activation, and
sprint-workflow scaffolding.

## Step 1 — List what is available

Run these first. Do **not** hardcode any names — always read from disk:

- `ls ~/.claude/plugins/brigade/agents/` — every agent file is one available role.
- `ls ~/.claude/plugins/brigade/presets/` — stack presets.
- `ls ~/.claude/plugins/brigade/rules/` — individual rule files.

For each agent, read the `name` and `description` fields from its frontmatter. For each
preset, read the first heading and the short description block.

## Step 2 — Ask which roles this project needs

Show a numbered checklist grouped logically. Example:

```
Which roles does this project need? (pick one or many, e.g. "1,3,5")

Development
  1. frontend      — React/Vue/Svelte, app logic, routing, state
  2. designer      — UI/UX, design systems, visual direction, styled components
  3. nodejs        — Node.js services, APIs, integrations
  4. golang        — Go services, CLI, microservices
  5. devops        — infra, CI/CD, k8s, cloud

  0. skip          — exit without changes
```

- `review-agent` is **always** auto-included when any dev role is picked. Do not show it in the list.
- `manager-agent` is **always** included — it is the orchestrator. Do not show it in the list.
- Specialist reviewers (`silent-failure-reviewer`, `test-coverage-reviewer`, `type-reviewer`) and Bug Council agents are spawned conditionally by `/brigade:run` and `/brigade:bug-council`. Do not show them in the list.

Wait for the user's selection. Do not proceed until they reply.

## Step 3 — Configure each picked role

For each selected role, check whether any preset or rule file applies to it. Today:

| Role | Ask about | Options |
|------|-----------|---------|
| frontend | Which React flavour? | `react-mobx-strict`, `react-basic`, or `no rules` |
| nodejs   | Which backend framework? | `nodejs-fastify`, `nodejs-express`, `nodejs-nestjs`, or `no rules` |
| designer, golang, devops | no presets yet | skip |

Ask only for roles that have real options. Keep questions tight — one per role, not a quiz.

Example if frontend was picked:
```
Configure frontend role:
  1. react-mobx-strict — MobX stores, presenter/container, strict i18n, tests required
  2. react-basic       — mandatory i18n + tests, no state-manager opinion
  3. no rules          — use frontend-agent defaults, no extra rules
```

Keep answers for later — collect all role → preset mappings before writing anything.

## Step 4 — Ask about file ownership (optional, short)

For each picked **development** role, ask one short question:

```
Which directories does the `frontend` role own?
(e.g. "apps/web/src/", "src/", or press Enter to fill in later)
```

Accept an empty answer — the user can edit `.planning/tasks/ROLES.md` later.

All dev roles own directories — ask for each picked role.

## Step 5 — Show the full plan and confirm

Print a preview of every file you will create or modify. Example:

```
Plan:

1. CLAUDE.md (create or update) — append "## Brigade rules" section:
   @~/.claude/plugins/brigade/presets/react-mobx-strict.md
   @~/.claude/plugins/brigade/presets/rust-tauri.md

2. .planning/tasks/ROLES.md (create):
   ## frontend
   agent: frontend-agent
   files: apps/web/src/
   stack: React 19, MobX, TypeScript

   ## rust
   agent: rust-agent
   files: src-tauri/
   stack: Rust, Tauri 2.x

3. .planning/tasks/sprint-1/_README.md (create): empty sprint skeleton.

4. Git: initialize repo if missing (will ask before running git init).

Confirm? (yes / no)
```

Wait for explicit `yes`. If `no`, stop and report that nothing was changed.

## Step 6 — Write files

Only after `yes`.

**Idempotence contract.** `/brigade:init` must be safe to re-run on a project that is already
partially or fully bootstrapped. For every file below:

- If the file does not exist, create it.
- If the file exists and already contains what we would write, do nothing and report "unchanged".
- If the file exists with different content that we understand, **merge** — never overwrite.
- If the file exists with a shape we do not understand, show it to the user and ask how to proceed.

**Never destroy existing user content.** If in doubt, ask. The user can always choose to
delete a file manually and re-run — that is their decision, not yours.

### 6a. CLAUDE.md

- If the file does not exist, create it with a `# <Project name>` heading (infer the name from `package.json`, `Cargo.toml`, or the folder name) followed by the `## Brigade rules` section.
- If the file exists and already has a `## Brigade rules` section, replace only that section's `@`-imports. Never touch anything else.
- If the file exists without that section, append a new `## Brigade rules` section at the end.

### 6b. .planning/tasks/ROLES.md

Create `.planning/tasks/` if missing.

**If `ROLES.md` does not exist:** write it with a short header explaining agent overrides, then one block per picked dev role:

```markdown
# Roles

Maps project roles to agents. Edit `agent:` to override with a custom agent — `/brigade:run`
will spawn whatever you put there. You can use:

- Built-in dev agents (`frontend-agent`, `nodejs-agent`, `designer-agent`, etc.)
- Custom project agents in `.claude/agents/<name>.md`
- Agents from other plugins (`some-plugin:agent-name`)

---

## {role_name}
agent: {agent-file-name}
files: {directories or empty}
stack: {free-form stack description or empty}
```

**If `ROLES.md` already exists: never overwrite it.** Read the current file and reconcile:

1. Parse out the existing role headings (`## frontend`, `## rust`, etc.).
2. Compare with the roles the user just picked in Step 2.
3. Branch on what you find:
   - **All picked roles already present** → do nothing. Report: `ROLES.md already has every picked role, left unchanged.`
   - **Some picked roles are new** → append only the missing blocks at the end of the file. Preserve the existing content, including any manual edits (different file ownership, stack descriptions, extra comments). Report: `Added N new roles to ROLES.md: {list}`.
   - **Some existing roles are NOT in the new pick** → do not remove them. Keep them. Report: `ROLES.md keeps N existing roles that you did not re-pick this time: {list}. Remove them manually if you no longer need them.`
   - **Shape is completely different** (no `## role_name` headings, custom format) → show the file to the user and ask how to proceed. Never auto-merge an unknown shape.

**Never delete or rewrite an existing role block.** If the user wants to change file ownership or stack for an existing role, they edit `ROLES.md` manually — that is their source of truth, not yours.

### 6c. .planning/tasks/sprint-1/_README.md

**Only create the skeleton if no sprint directory exists yet.** Check:

1. If `.planning/tasks/sprint-*/` is empty (no sprint directories) → create `sprint-1/_README.md` with the skeleton below.
2. If at least one `sprint-N/` already exists → **do not create a new sprint skeleton.** Report: `Sprint structure already exists (latest: sprint-{N}), left unchanged. Run /brigade:plan to add work to the current sprint.`
3. **Never overwrite an existing `sprint-*/_README.md`.** It may contain real sprint data written by `/brigade:plan` or `manager-agent`.

Skeleton for a fresh sprint-1:

```markdown
# Sprint 1

**Goal:** _(set via `/brigade:plan`)_

## Waves
_(to be populated)_

## File map
_(to be populated)_
```

### 6d. Git initialization (if not already a repo)

If the project is **not** a git repo:
- Ask the user: "Project is not a git repo. Initialize one? (yes / no)"
- If yes: `git init` and continue to Step 6e.
- If no: skip to Step 7 — you cannot commit without a repo, and `/brigade:run` will not work without git anyway.

**Critical reminder if you just ran `git init`:** Claude Code detects git repos only at session
startup. Tell the user: "Git initialized. Restart Claude Code (`/exit` then reopen) before
running `/brigade:plan` or `/brigade:run` — worktree isolation requires a fresh session." Then stop.

### 6e. Commit the bootstrap files

`/brigade:run` refuses to start on a dirty working tree, so the files you just wrote must be
committed before this command returns. If the repo has unrelated dirty paths (the user's own
changes, IDE artifacts), **leave them alone** — only stage and commit the paths you wrote.

Run:
```bash
git status --short
git add CLAUDE.md .planning/tasks/
# If you also wrote .claude/settings.json earlier, include it — but 0.6+ does not.
git commit -m "chore: bootstrap brigade plugin"
```

Rules:
- Only `git add` the files produced by Steps 6a–6c. Never touch other dirty paths.
- If `git commit` fails (pre-commit hooks, missing user.email, etc.), stop and show the user the exact error. Do not use `--no-verify`. Do not retry with a different message.
- If the bootstrap didn't actually write anything new (idempotent no-op — ROLES.md already had all picked roles, sprint already exists, CLAUDE.md already had the section), skip the commit entirely and report: `Nothing to commit — bootstrap was a no-op.`

## Step 7 — Report

Print:
1. Every file created or modified with its path.
2. What the user should do next:
   - On an **existing project**: "Run `/brigade:onboard` to scan the codebase and produce `.planning/ARCHITECTURE.md` — the planner reads it for better task decomposition."
   - On a **greenfield project**: "Run `/brigade:plan <feature>` to create your first sprint, then `/brigade:run` to execute it."

## Hard rules for you while running this command

- **Do not invent roles, presets, or rules.** Always `ls` the real directories first.
- **Do not auto-detect the stack.** The user picks explicitly in Step 2–3.
- **Do not mass-edit existing files.** Only the `## Brigade rules` block in CLAUDE.md, and new files under `.planning/tasks/`.
- **Show every write as a diff before doing it.** Confirmation in Step 5 is mandatory.
- **Do not install dependencies.** Never run `npm install`, `cargo add`, etc.
- **Do not mix waves of questions.** One step at a time: roles → configs → ownership → plan → confirm → write.
- **Be idempotent.** Re-running `/brigade:init` on a bootstrapped project must not destroy existing `ROLES.md`, `CLAUDE.md`, `sprint-*/_README.md`, or `settings.json` content. Merge or leave alone — never blind-overwrite.
