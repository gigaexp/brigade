---
description: Show current sprint state — tasks, waves, review verdicts, learnings carry-over
---

You are printing a status dashboard for the current brigade state. Read-only — never modify
files. Goal: give the user a quick overview without opening 10 files manually.

## Step 1 — Locate state

Check if this is a brigade-enabled project:
- If `.planning/tasks/ROLES.md` does not exist → print: "Not a brigade project. Run `/brigade:init` to bootstrap." and stop.

Read:
- `.planning/tasks/ROLES.md` — roles and agent mapping
- `.planning/ARCHITECTURE.md` (if exists) — module count
- `.planning/learnings.md` (if exists) — recent patterns
- `.planning/tasks/sprint-*/` — all sprint directories

## Step 2 — Identify current sprint

Pick the highest-numbered sprint. Read its `_README.md` for goal, waves, file map.

## Step 3 — Parse task specs

For each task file in the current sprint (`S{N}.{M}-*.md`):
1. Read frontmatter: `id`, `title`, `role`, `status`, `wave`, `depends`
2. Determine effective status:
   - `done` — status: done
   - `in-progress` — status: in-progress OR has feature branch `feat/s{N}.{M}-*` in git
   - `blocked` — any `depends` task is not yet done
   - `todo` — otherwise

## Step 4 — Check review reports

For each wave with reports in `reviews/`:
- Read `wave-{W}-summary.md` if exists → extract verdict + counts
- Otherwise scan individual review files

## Step 5 — Print the status

Format (use ANSI colors for terminal, fall back to plain text if not):

```
brigade status — {project-path}

Sprint {N} — {done}/{total} tasks done ({pct}%)
Goal: {sprint goal from _README.md}

  {icon} {id} {title:40}  {agent:15} {model:8} {notes}

Waves:
  Wave 1 {icon} ({task count})   — {verdict or "in progress" or "pending"}
  Wave 2 ...

{if learnings exists}
Learnings carry-over from previous sprints:
  - {pattern}: {suggestion}
  - ...
{endif}

{if any task blocked}
Blocked:
  {id} {title} — waiting on {dependency}
{endif}

Next action: {suggestion based on state}
```

### Icons

- `✓` green — done
- `⋯` yellow — in progress
- `○` gray — todo
- `⊘` red — blocked
- `✗` red — failed / REQUEST CHANGES

### Next action logic

- If all tasks done + waves approved → "Sprint complete. All waves passed the merge gate — open a PR when ready to merge to main."
- If wave in progress → "Wait for current wave to finish, or run `/brigade:run` to continue."
- If wave halted on REQUEST CHANGES → "Wave {W} halted. Critical findings in `.planning/tasks/sprint-{N}/reviews/`. Fix and run `/brigade:run` again."
- If sprint all done but branches still outstanding → "All tasks complete. Run `/brigade:resume` to merge outstanding branches through the review gate."
- If no sprint exists yet → "Run `/brigade:plan <feature>` to create the first sprint."

## Step 6 — Show global stats (footer)

```
Stats across all sprints:
  Total sprints: {N}
  Total tasks completed: {M}
  Most-used agent: {agent}
  Avg wave duration (approved): {time, if detectable from git log}
```

Keep it short — max 3-4 lines.

## Hard rules

- **Read-only.** Never write or modify files.
- **Never invent data.** If a file is missing, say so — don't guess.
- **Fast.** No subagents, no heavy git operations. Just file reads + simple git log.
- **Respect ROLES.md overrides.** If user edited agent names in ROLES.md, show those, not the defaults.
