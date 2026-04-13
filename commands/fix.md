---
description: Fix a bug or ship a small change — skip design phase, go straight to sprint planning
argument-hint: <bug description or small change>
---

You are running a fast-path for bug fixes and small changes. Unlike `/brigade:plan`, this
command **skips the design phase** and goes straight to sprint planning with `manager-agent`.

## When to use `/brigade:fix` vs `/brigade:plan`

Use `/brigade:fix` for:
- Bug fixes (one clear symptom, one root cause)
- Small refactors (rename, extract, move)
- Config changes that have behavior but don't need architectural thought
- Dependency updates
- Copy/text changes
- Anything where the "what to build" is obvious and you just need rigor (tests, file ownership, review)

Use `/brigade:plan` for:
- New features
- Anything that needs to explore alternatives
- Work that touches multiple modules or roles
- Anything where you'd benefit from a written design doc

When in doubt: if you can describe the change in one sentence AND you know exactly
which files to touch, use `/brigade:fix`. Otherwise use `/brigade:plan`.

## Preflight

1. Verify `.planning/tasks/ROLES.md` exists. If missing, tell the user to run `/brigade:init` first and stop.
2. Verify the working tree is clean. If dirty, tell the user to commit or stash and stop.

## Step 1 — Understand the problem (brief)

Unlike `/brigade:plan` phase 1, don't run a full brainstorming session. Just ask the user for
missing critical info if any:

- If the argument is vague ("fix the bug"), ask: "Which bug? Point me to the error, test,
  or symptom you're seeing."
- If you don't know which files are affected, ask once: "Which files should I look at?" OR
  quickly grep for relevant symbols yourself.
- If the fix approach has two obvious paths, ask: "I can do X or Y — which do you prefer?"
  (One question, not a design session.)

**Do not** propose multiple approaches, write a design doc, or create a spec file.
**Do not** ask more than 2 questions. If you need more, stop and suggest `/brigade:plan` instead.

## Step 2 — Spawn manager-agent with fix-mode instructions

Call the Agent tool with:
- `subagent_type`: `manager-agent`
- `isolation`: `none`
- `description`: `Plan fix: $ARGUMENTS`
- `prompt`:
  ```
  Plan a small fix or bug repair. This is fast-path mode — NOT a new feature.

  User request: $ARGUMENTS

  Additional context from the user (if any): {paste anything captured in Step 1}

  Follow your `plan` workflow, but with these constraints:

  1. Read .planning/tasks/ROLES.md and the project CLAUDE.md.
  2. Read .planning/ARCHITECTURE.md if it exists.
  3. Create at MOST 1-3 tasks. Most fixes need 1 task. Only split if the fix genuinely
     spans multiple roles (e.g. backend change + frontend change) or multiple files that
     can be worked in parallel.
  4. Each task must have:
     - A clear `role`
     - `files_modify` listing the exact files (no glob patterns, specific paths)
     - Required Tests — for bugs, this MUST include a regression test that reproduces
       the bug. "I verified manually" is not acceptable.
  5. Write task specs under .planning/tasks/sprint-N/ (latest open sprint or create new).
  6. Update sprint-N/_README.md with a new section for this fix.
  7. Assign waves: if 1 task, it's wave 1. If multiple independent tasks, one wave.

  Do NOT:
  - Write a design doc
  - Create multiple alternatives
  - Expand scope beyond what the user asked for
  - Add "while I'm here" improvements
  - Write any feature code

  Return: task IDs created, which wave, which files they'll touch, and whether they
  include regression tests.
  ```

## Step 3 — Check for repeated failures (auto-escalate to Bug Council)

Before spawning manager, check if this is the Nth attempt on the same bug:

1. Scan `.planning/tasks/sprint-*/` for recent tasks with titles similar to `$ARGUMENTS`.
2. For each matching task, check its status and any review reports.
3. If the same bug has been worked on **3+ times** with failures (status: blocked,
   REQUEST CHANGES on fixes, or the same test still failing) → **auto-escalate to
   Bug Council** instead of spawning manager.

Tell the user:
```
This bug has been worked on {N} times without success. Spinning up Bug Council instead
of another fix attempt — 5 diagnostic specialists will analyze from different angles.

Running /brigade:bug-council "{bug description}" ...
```

Then invoke `/brigade:bug-council` with the bug description. Stop this command — bug-council
takes over.

If this is the first or second attempt, proceed to Step 4 as normal.

## Step 4 — Confirm and suggest next step

After manager returns:

1. Relay the summary verbatim to the user.
2. If everything looks reasonable, suggest:
   ```
   Run `/brigade:run` to execute the fix, or `/brigade:run --task {id}` to run just this task.
   ```
3. If manager flagged anything risky (fix scope unclear, tests hard to write, touches
   many files), surface those concerns and ask the user whether to proceed.
4. If `/brigade:run` later fails on this fix, remind the user that `/brigade:bug-council` is
   available as the next escalation.

## Hard rules

- **No design phase.** Don't run brainstorming. Don't write to `.planning/specs/`.
- **No scope creep.** The fix is what the user asked for. Not what manager thinks would
  be better "while we're here".
- **Regression tests are mandatory for bug fixes.** If the task is "fix bug X", the
  regression test is the proof the fix works. No exceptions.
- **Max 2 clarifying questions.** If you need more, stop and tell the user to use `/brigade:plan`.
- **Never touch source code yourself.** Only manager-agent writes task specs. Workers
  execute them via `/brigade:run`.
