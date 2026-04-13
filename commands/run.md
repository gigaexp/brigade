---
description: Execute the current sprint wave by wave — spawns worker agents in worktrees from the top-level session
---

You are executing the current sprint directly in the top-level conversation. **Do not delegate orchestration to manager-agent** — Claude Code subagents cannot spawn further subagents, so the top-level session must drive the wave-by-wave execution itself.

## Preflight

1. Verify `.planning/tasks/ROLES.md` exists. If missing, tell the user to run `/brigade:init` first and stop.
2. Verify the working tree is clean (`git status`). If dirty, ask the user to commit or stash and stop.
3. Confirm you are on `main` or `master`. If not, ask the user to check out the base branch and stop.
4. **Tell the user about the permission flow before starting.** Print a short notice:

   > Workers will run in **foreground** mode — you will see their progress live and may be asked to approve some tool calls (Write, Bash for git/test runners). Approve with "Allow for session" on the first call of each kind; Claude Code remembers it and subsequent calls will not prompt. The main conversation is blocked while a wave runs — you can move workers to background with `ctrl+b` if you need the chat free, but then preapprove the required tools in `~/.claude/settings.json` first.

   Then proceed.

## Step 1 — Find the current sprint and wave

1. List `.planning/tasks/sprint-*/` and pick the highest-numbered sprint as current. Read its `_README.md`.
2. Read `.planning/tasks/ROLES.md` into memory — you will need the role → agent mapping later.
3. **Sync statuses with git history.** Run `git log --oneline` on the current branch. For every task spec in the sprint whose `status:` is still `todo`, check whether any commit message contains its task id (e.g. `s1.3`). If yes, update that task's frontmatter to `status: done` and mark it done in `_README.md`. Commit the status updates to the base branch with message `chore: sync sprint statuses`.
4. Identify the **current wave**: the lowest-numbered wave that still has tasks with `status: todo`. If every task is `done`, skip to Step 4 "Final verification".

## Step 2 — Spawn workers for the current wave (in parallel)

1. Collect every task in the current wave with `status: todo` and all `depends` satisfied (dependent tasks already `done`).
2. For each task:
   - Read the task spec file in full.
   - Look up the task's `role` in `ROLES.md` → find the `agent` name (e.g. `frontend-agent`).
3. Spawn **all collected tasks in a single assistant message** as multiple parallel Agent tool calls. Claude Code runs them concurrently only when they are emitted in the same message — never split a wave across messages.

Each Agent call uses:
- `subagent_type`: the agent name from ROLES.md (e.g. `frontend-agent`)
- `isolation`: `worktree` — **MANDATORY for every Agent call without exception**
- `model`: choose based on task complexity (see Model Selection below)
- `description`: `{task_id} {short title}`
- `prompt`: the template below, with the full task spec interpolated

**🚨 ISOLATION ENFORCEMENT — non-negotiable:**

Every single Agent call in this command MUST include `isolation: "worktree"`. This
applies to:
- Initial wave workers (Step 2)
- Fix wave workers (re-runs after critical findings)
- Model escalation re-dispatches (haiku → sonnet → opus retries)
- ANY worker spawn at any point during sprint execution

Without worktree isolation, parallel workers branch in the main tree and stomp on each
other's files — tests pass individually but break when merged. This was caught in real
usage (sprint 1 url-shortener) and is a class of bug we must eliminate at source.

Before emitting any Agent call, verify in your own message that `isolation: "worktree"`
is present. If you find yourself about to spawn an Agent without it, STOP and fix the
call.

**Do not pass `run_in_background`.** Workers run in foreground so permission prompts
for Write/Bash can be answered interactively by the user. Foreground Agent calls emitted
in a single assistant message still run in parallel — Claude Code spawns them concurrently.

### Model selection for workers

Choose the starting model based on task complexity:

| Signal | Model |
|---|---|
| Task touches ≤ 2 files, no dependencies, type is `docs`/`config`/`test` | `haiku` |
| Default — most implementation tasks | `sonnet` |
| Task touches ≥ 5 files, has `risk: high`, or type is `architecture`/`migration` | `opus` |

**Escalation on failure:** If a worker fails (tests don't pass, can't complete the task, reports errors), re-dispatch the SAME task with the next tier model:
- `haiku` → `sonnet` → `opus`
- `sonnet` → `opus`
- `opus` → `opus` (retry once, then HALT and report to user)

Do not escalate more than twice per task. On second opus failure, halt the wave and report.

Prompt template (one per task):
```
Execute this task.

# Task Spec
{paste the ENTIRE content of the task spec file here — frontmatter and body}

# Worker rules
- Create a feature branch FIRST: `git checkout -b feat/{task_id}-short-slug`
- Touch ONLY files listed in `files_modify`
- Do NOT touch files in `files_no_touch`
- NEVER pull, merge, or cherry-pick from other feature branches
- Write ALL tests from the "Required Tests" section — no tests means the task is rejected
- Run the full test suite. All tests must pass before you commit.
- Do NOT modify any files under `.planning/tasks/`
- Commit with message: `feat: {task_id} {short description}`
- After the commit, print the branch name and "done" so the orchestrator can pick you up
```

**Do not mix waves.** Never emit Agent calls for two different waves in the same message.

## Step 3 — After the wave completes: merge gate

Wait for every agent in the wave to finish. Foreground Agent calls return when the agent commits its work and prints "done" — you see the result inline in the main session as each worker completes.

### 3a. Merge worker branches into the base branch

For each merged task, in task-id order:
1. `git checkout main` (or `master`)
2. `git merge --no-ff feat/{task_id}-...`
3. If a conflict is simple (whitespace, trivially resolvable), resolve it and commit the merge.
4. If a conflict is substantive, **stop and ask the user how to proceed.** Do not guess.

### 3b. Run the full test suite

Detect the project's test command from `package.json` / `Cargo.toml` / `Makefile`. Run it. All tests must pass before continuing.

### 3c. Code review gate — parallel fan-out

**Why fan-out.** A single generalist reviewer misses specialist-level bugs. Three specialists found 7 criticals that the generalist approved twice. Specialists and generalist are complementary — run both.

**Scope detection — which specialists to spawn.**

Before spawning, inspect the diff to decide which specialists are worth running. Run:

```bash
git diff --name-only HEAD~{merged_branch_count}..HEAD
git diff HEAD~{merged_branch_count}..HEAD
```

Build the list of reviewers:

| Reviewer | Always spawn? | Spawn condition |
|---|---|---|
| `review-agent` (generalist) | ✅ always | Baseline — reads CLAUDE.md + project rules, covers general quality |
| `silent-failure-reviewer` | conditional | Diff contains `catch`, `try`, unhandled promises, or unsafe `as` casts |
| `test-coverage-reviewer` | conditional | Any file matching `.test.` / `.spec.` / `__tests__/` is in the diff |
| `type-reviewer` | conditional | New `type`/`interface`/`struct`/`trait` declarations in the diff |
| `designer-agent` | conditional | Diff touches `src/styles/`, `src/components/ui/`, `tailwind.config.*`, or any `.css`/`.scss`/`.module.css` file, AND ROLES.md has `designer` role |

All reviewers are bundled in this plugin — no external dependencies needed.

**Spawn all selected reviewers in parallel** (single assistant message with multiple Agent calls). Each reviewer writes its report to a distinct file under `.planning/tasks/sprint-{N}/reviews/`:

| Reviewer | Output file |
|---|---|
| `review-agent` | `wave-{W}-review-generalist.md` |
| `silent-failure-reviewer` | `wave-{W}-review-failures.md` |
| `test-coverage-reviewer` | `wave-{W}-review-tests.md` |
| `type-reviewer` | `wave-{W}-review-types.md` |
| `designer-agent` | `wave-{W}-review-visual.md` |

**Designer review prompt (different from implementation mode).** When spawning `designer-agent`
in review mode, use this specialized prompt instead of the generic reviewer template:

```
You are in VISUAL REVIEW mode, not implementation mode.

Review the visual/UI changes from wave {W} of sprint {N}.

Scope: `git diff HEAD~{merged_branch_count}..HEAD` — focus only on style/UI files.

Check for:
1. Generic AI aesthetics — Inter font, purple gradients, cookie-cutter layouts → REJECT
2. Design tokens — are colors/spacing/typography going through CSS variables or are they hardcoded?
3. Consistency with existing design system — does the diff match the existing aesthetic direction?
4. Typography hierarchy — font choices, sizes, weights
5. Spacing rhythm — consistent padding/margin scale
6. Interactive states — hover, focus, disabled, active states present?
7. Accessibility — focus indicators, ARIA labels, keyboard navigation

Do NOT write any code. Only produce a review report.

Write your report to: .planning/tasks/sprint-{N}/reviews/wave-{W}-review-visual.md

Use confidence scoring. Only report findings with confidence >= 50.
End your report with an explicit verdict: APPROVE / REQUEST CHANGES / NEEDS DISCUSSION.
```

Prompt template (adapt per reviewer — each specialist already has its own role in frontmatter):

```
Review the code changes from wave {W} of sprint {N}.

Scope: `git diff HEAD~{merged_branch_count}..HEAD`

Tasks in this wave:
{list of task ids + titles}

Write your full report to: .planning/tasks/sprint-{N}/reviews/{output-file-per-reviewer}.md
Create the reviews/ directory if it does not exist.

Use confidence scoring. Only report findings with confidence >= 50.
End your report with an explicit verdict: APPROVE / REQUEST CHANGES / NEEDS DISCUSSION.
```

### 3d. Aggregate verdicts and act

Wait for all spawned reviewers to return. Read every report file written in 3c and compute a combined verdict:

**Combined verdict rules:**
- If **any** reviewer returned REQUEST CHANGES with at least one Critical finding → combined verdict is **REQUEST CHANGES** → **HALT**.
- If the worst verdict across all reviewers is `NEEDS DISCUSSION` → stop and ask the user to decide (no auto-proceed).
- If every reviewer returned APPROVE or only warnings/suggestions → combined verdict is **APPROVE** → proceed.

**Write an aggregate summary** to `.planning/tasks/sprint-{N}/reviews/wave-{W}-summary.md`:

```markdown
# Wave {W} review summary

| Reviewer | Verdict | Critical | Warnings | Suggestions |
|---|---|---|---|---|
| review-agent | APPROVE | 0 | 2 | 3 |
| code-reviewer | REQUEST CHANGES | 2 | 5 | 1 |
| silent-failure-hunter | REQUEST CHANGES | 3 | 4 | 0 |
| pr-test-analyzer | APPROVE | 0 | 1 | 2 |

**Combined verdict:** REQUEST CHANGES (5 critical across 2 reviewers)

## Critical findings (deduplicated)

1. [file:line] ... *(code-reviewer, silent-failure-hunter)*
2. ...
```

**On HALT:**
- Print the aggregate summary to the user.
- Print each critical finding verbatim with the source reviewer in parentheses.
- Tell the user: "Wave {W} halted on {N} critical findings across {M} reviewers. Create fix tasks with `/brigade:plan`, or run `/brigade:run` again after manual fixes."
- Do not proceed to the next wave.

**On APPROVE:**
- Print the aggregate summary in 2–3 lines (counts only).
- Proceed.

### 3e. Wave cost summary

After review, print a short cost summary for the wave:

```
Wave {W} summary:
  Tasks: {N} completed
  Workers: {list of agent types used}
  Models: {list of models used, note any escalations}
  Review: {verdict} ({N} reviewers, {N} critical, {N} warnings)
```

This gives the user visibility into what happened without a full dashboard.

### 3f. Pattern sweep after fix waves

**Only if this wave was a fix wave** (running tasks created to address findings from a
previous wave's review gate, e.g. wave 1.5 fixing wave 1 findings), spawn `pattern-matcher`
**immediately after merge** to scan the codebase for similar bugs that the targeted fix
might have missed.

Why: real-world testing showed that fix waves work point-by-point. A fix to `onClose`
left similar `closeDatabase` unguarded — the same class of bug remained elsewhere.
Pattern-matcher catches this systematically.

Spawn (single Agent call, `isolation: "worktree"`):
- `subagent_type`: `pattern-matcher`
- `description`: `Sweep for similar bugs after fix wave {W}`
- `prompt`:
  ```
  A fix wave just closed these findings:
  {list the critical/warning findings that were addressed in this wave}

  Sweep the codebase for SIMILAR patterns that might have the same class of bug.
  Use the techniques in your skill: identify the pattern shape, grep variations,
  find working examples, list bug locations.

  Write your report to: .planning/tasks/sprint-{N}/reviews/wave-{W}-pattern-sweep.md

  If you find additional instances:
  - Critical: must be fixed in this sprint → recommend creating fix tasks
  - Warning: should be fixed soon → add to learnings as carry-over debt
  - Suggestion: could be improved → log only

  Verdict: SAFE / NEEDS FIXES / NEEDS DISCUSSION
  ```

Act on pattern-matcher's verdict:
- **NEEDS FIXES with critical findings** → halt the sprint, print findings, ask user to
  approve creating new fix tasks via `/brigade:plan` or to override
- **NEEDS DISCUSSION** → stop and ask user
- **SAFE** → proceed normally

If the wave was a regular planned wave (not a fix wave), skip this step entirely.

### 3g. Update task statuses

For each task in the wave that was merged successfully:
1. Open its spec file, change `status: todo` → `status: done`.
2. Update `_README.md` to reflect completed tasks.
3. Commit with message `chore: complete wave {W} of sprint {N}` together with the review report file.

### 3h. Branch cleanup

```bash
git branch --merged main | grep -E '^\s*feat/' | xargs -r git branch -d
```
Verify only `main` (or `master`) remains among the long-lived branches.

## Step 4 — Next wave

Go back to Step 1 point 4 and find the next wave. Repeat until every task in the sprint is `done`.

## Step 5 — Final verification

When all waves are complete:
1. Run the full test suite one more time.
2. Confirm every task spec has `status: done`.
3. Print a summary to the user: sprint name, number of waves executed, number of tasks completed, any critical findings that were flagged and resolved.

## Step 6 — Write sprint learnings

Analyze the completed sprint and detect recurring problems. Write or append to
`.planning/learnings.md`. This file is read by `manager-agent` on the next `/brigade:plan`
to avoid repeating mistakes.

### Detection patterns

Scan the sprint for these signals, in order:

1. **HIGH_REVIEW_ROUNDS** — If any wave had a reviewer return `REQUEST CHANGES` more
   than once before approval, record it. The task spec was probably too vague.

2. **MODEL_ESCALATION** — If any task was escalated from sonnet → opus (or haiku → sonnet),
   record it. The manager probably underestimated complexity.

3. **TASK_BLOCKED** — If any worker reported BLOCKED status, record it. Missing context
   or bad spec.

4. **WAVE_HALTED** — If any wave halted on critical review findings, record it.
   Insufficient tests or missing verification.

5. **LOW_COMPLETION_RATE** — If < 80% of planned tasks reached `done`, record it.
   Sprint was over-committed.

6. **FILE_OVERLAP_CONFLICT** — If merge had non-trivial conflicts, record it.
   File ownership wasn't specific enough.

### Write format

Append to `.planning/learnings.md`:

```markdown
## Sprint {N} — {date}

**Duration:** {waves executed} waves, {tasks completed}/{tasks planned} tasks

### Patterns detected

- **{PATTERN_NAME}**: {specific example from this sprint}
  Suggestion: {concrete action for next sprint — e.g. "add explicit acceptance criteria
  to task specs" or "break tasks into smaller units when touching 5+ files"}

- ...

### What worked

{1-2 bullets on things that went smoothly — helps reinforce good patterns}
```

If no patterns detected, write a short positive note:
```markdown
## Sprint {N} — {date}

Completed cleanly — no recurring issues detected. {N} tasks in {N} waves, all approved
on first review round.
```

Create `.planning/learnings.md` if it doesn't exist.

Commit the learnings file: `git add .planning/learnings.md && git commit -m "docs: sprint {N} learnings"`.

## Step 7 — Report

Suggest: "All waves passed the 5-reviewer merge gate. The sprint branch is ready — open a PR when you want to merge to main. Do NOT invoke external review commands — the fan-out review gate in each wave already covered generalist, silent-failure, test-coverage, type-design, and (if UI changed) visual review."

## Hard rules

- **🚨 ALWAYS use `isolation: "worktree"` on every Agent call.** No exceptions. Initial workers, fix waves, model escalation retries, ANY Agent spawn during sprint execution. Without worktree isolation, parallel workers stomp on each other's files.
- **No nested subagent calls.** You (top-level main Claude) are the orchestrator. Never delegate orchestration to `manager-agent` — it is a subagent and cannot spawn further agents.
- **Use `manager-agent` only through `/brigade:plan`** for planning (creating task specs). Never call it during execution.
- **Spawn every wave in one message.** Parallelism only works when multiple Agent tool calls are in the same assistant response.
- **Never mix waves.** Finish wave N's merge gate before starting wave N+1.
- **Halt on critical review findings.** Do not try to fix or override them yourself — that decision belongs to the user.
- **Never skip tests.** If the test suite fails, stop and report. Do not "fix it later".
- **Never force-push or delete unmerged branches.** Cleanup only touches branches whose commits are already on the base branch.
