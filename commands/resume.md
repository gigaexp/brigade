---
description: Resume an interrupted sprint — detect where /brigade:run stopped and continue, or recover outstanding branches after manual fixes
---

You are resuming a sprint that was interrupted. Auto-detect the state and continue from
the right place. This command covers three scenarios:

1. **Interrupted run** — `/brigade:run` was stopped mid-wave (session crashed, user
   pressed ctrl+c, or workers hung). Pick up where it stopped.
2. **Manual merge recovery** — a wave halted on review findings, user fixed them manually,
   now wants to merge outstanding branches and continue.
3. **Forgotten state** — user came back after days/weeks and doesn't remember what's done.

**Do not delegate orchestration to manager-agent** — subagents can't spawn further
subagents. This command runs at the top level.

## Preflight

1. Verify `.planning/tasks/ROLES.md` exists. If missing, stop and tell the user to run `/brigade:init`.
2. Verify the working tree is clean (`git status`). If dirty, ask the user to commit or stash and stop.
3. Confirm you are on `main` or `master`. If not, ask the user to check out the base branch and stop.

## Step 1 — Detect current state

Read these inputs, in order:

1. **Current sprint**: list `.planning/tasks/sprint-*/`, pick highest-numbered. Read `_README.md`.
2. **Task statuses**: scan every `S{N}.{M}-*.md` spec file for `status:` field. Count done / in-progress / todo / blocked.
3. **Git branches**: `git branch --list 'feat/*' --no-merged main`. These are outstanding branches that never got merged.
4. **Commits on main not yet recorded**: `git log --oneline main ^{base}` filtered by `feat: s{N}.{M}` patterns. Find tasks whose commits are already on main but whose spec still says `status: todo`.
5. **Review reports**: `ls .planning/tasks/sprint-{N}/reviews/` — which waves have review reports, what were the verdicts.

## Step 2 — Classify the situation

Based on inputs, pick ONE of these scenarios and proceed accordingly.

### Scenario A: Status drift only

Some tasks have commits on main (`feat: s{N}.{M}` in log) but their spec still says `status: todo`.

**Action:**
- For each drifted task, update its spec frontmatter → `status: done`.
- Mark completed in sprint `_README.md`.
- Commit: `chore: sync sprint statuses`.
- Re-run state detection. May unlock Scenario B/C/D.

### Scenario B: Outstanding branches, no merge yet

`git branch --no-merged main` returns feature branches. No merge has happened yet — wave was in the middle of execution when interrupted.

**Action:**
- For each outstanding branch, find the matching task spec and verify:
  - Task exists in a sprint
  - Required Tests section exists
  - Tests from Required Tests are present in the branch: `git show {branch}:{test_file}`
- **Eligible** = branch has matching spec + all required tests present.
- **Rejected** = missing spec (orphan branch) or missing required tests. Report but do not merge.
- Merge eligible branches **sequentially** (`git merge --no-ff {branch}`), in task-id order.
  - On trivial conflicts: resolve and commit merge.
  - On substantive conflicts: STOP and ask user.
- Run the full test suite. Halt on failure.
- **Run the merge gate** (same as `/brigade:run` Step 3c/3d): spawn the applicable
  reviewers (generalist + specialists based on diff) in parallel, aggregate verdicts.
  If critical findings → halt. If approved → continue.
- Update task statuses → `done`. Commit `chore: resume sprint {N} wave {W}`.
- Clean up merged branches: `git branch --merged main | grep '^\s*feat/' | xargs -r git branch -d`.
- Proceed to Scenario C (next wave) or Scenario D (sprint complete).

### Scenario C: Clean state, wave pending

No outstanding branches. Sprint is not complete — there are more tasks to run. This means
the previous wave was merged cleanly and the user left before starting the next one.

**Action:**
- Tell the user the situation: "Sprint {N}: wave {last} completed, wave {next} pending with {N} tasks."
- Ask: "Run wave {next} now? (yes/no)"
- If yes → delegate to `/brigade:run` (just invoke the run workflow from here, do not spawn a subagent).
- If no → stop and exit.

### Scenario D: Sprint complete

All tasks in the current sprint are `done`. No outstanding branches.

**Action:**
- Run the full test suite one more time to confirm.
- Print sprint summary: total tasks, waves executed, any critical findings that were resolved.
- Generate sprint learnings (same as `/brigade:run` Step 6) and append to `.planning/learnings.md`.
- Suggest next steps: "All waves cleared the merge gate. Open a PR with the sprint branch when ready to merge to main, or run `/brigade:plan` for the next feature."

### Scenario E: Conflicting state

Something doesn't add up — commits without specs, specs without commits, branches that
don't match any task, review files for waves that never ran, or mismatched task IDs.

**Action:**
- STOP. Print a diagnostic report showing what you found and what's inconsistent.
- Ask the user to clean up manually or explicitly tell you which path to take.
- Never guess on ambiguous state.

## Step 3 — Report

After handling the scenario (or halting), print a final status summary:

```
Resume complete.

Sprint: {N}
Scenario: {A/B/C/D/E}
Actions taken:
  - {action 1}
  - {action 2}
Current state:
  - {N}/{M} tasks done
  - {K} branches remaining
  - Next action: {run wave {W+1} / merge / nothing / manual cleanup}
```

## Hard rules

- **No nested subagent calls.** You are the top-level orchestrator.
- **Never guess on ambiguous state.** Scenario E exists for a reason — halt and ask.
- **Reject branches missing required tests.** Do not merge them "just this once".
- **Halt on critical review findings.** The user decides whether to override.
- **Never delete unmerged branches.** Cleanup is for merged-only.
- **Always run the merge gate on resumed merges.** Skipping review because "user already looked at it" leads to regressions.
- **Respect the sprint plan.** Do not add, remove, or reorder tasks — only continue execution.
