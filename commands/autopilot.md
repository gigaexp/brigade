---
description: Fully autonomous pipeline — plan a feature and execute it end-to-end without user confirmations. Launch and walk away.
argument-hint: "<feature description | @file.md>"
---

You are running brigade in **full autonomous mode**. The user wants to launch this command
and walk away — you should take the feature from idea to shipped code without asking for
confirmation at any HARD GATE, only halting on genuinely blocking issues.

## What this does

`/brigade:autopilot` is a meta-command that chains:

1. **`/brigade:plan --auto-approve $ARGUMENTS`** — runs phase 1 (brainstorm + design + architecture) AND phase 2 (manager-agent → task specs) without waiting on user approval at any HARD GATE. Design doc and ARCHITECTURE.md still get written as artifacts.

2. **`/brigade:run --autonomous`** — executes every wave sequentially. On critical review findings, auto-creates fix tasks via manager-agent and runs them. On 3+ fix failures, auto-escalates to Bug Council. Only halts on unresolvable conflicts or 5+ iterations on the same task.

3. **Auto-resume on error** — if the session survives an API timeout, continue from where it stopped using the same logic as `/brigade:resume`.

## Preflight

1. Verify `.planning/tasks/ROLES.md` exists. If missing, tell the user to run `/brigade:init` first and stop.
2. Verify the working tree is clean. If dirty, stop and tell the user to commit or stash.
3. **Warn the user explicitly before starting:**

   ```
   brigade:autopilot — fully autonomous mode

   This will:
     - Skip design and architecture HARD GATEs (artifacts still written)
     - Execute all sprint waves without pause between them
     - Auto-create fix tasks on critical review findings
     - Auto-escalate to Bug Council after 3+ failed fix attempts
     - Halt only on: unresolvable conflicts, 5+ iterations on a task, NEEDS DISCUSSION verdicts

   The session will not ask for your confirmation until it's done or stuck.

   For true walk-away behavior, make sure permissions are pre-approved in
   ~/.claude/settings.json (Bash, Write, Edit for the patterns you use).

   Proceed? (yes / no)
   ```

   Wait for `yes`. On `no`, stop.

4. Read `.planning/config.json` and override in-memory: `config.autonomous.enabled = true`.
   If `config.autonomous.auto_apply_bug_council` is not set, default it to `true` in autopilot mode
   (the whole point is to not stop).

## Step 1 — Plan phase (design + sprint breakdown)

Invoke `/brigade:plan --auto-approve $ARGUMENTS` by executing its workflow inline. Key
behavior differences from interactive `/brigade:plan`:

- **Phase 1 design:** ask clarifying questions about genuine gaps only. Don't ask
  "which tech stack?" if the spec or ARCHITECTURE.md answers it. Write the design doc
  without waiting for a "yes" approval.

- **Architecture:** generate `.planning/ARCHITECTURE.md` from the design, present a short
  summary to the user (so they see what was decided), write the file without waiting for approval.

- **Phase 2:** spawn `manager-agent` with the approved design + architecture. Wait for
  it to return the sprint plan.

After phase 2 completes, **do not ask** "proceed to execution?". Go straight to Step 2.

## Step 2 — Execute all waves

Run `/brigade:run --autonomous` inline. Key behavior:

- Spawn each wave's workers in parallel (isolation: worktree — mandatory).
- Run the merge gate with reviewers per `config.review.mode` (default `full`).
- On **APPROVE** or warnings-only → proceed to next wave.
- On **REQUEST CHANGES + critical** → aggregate findings, spawn `manager-agent` to plan
  a fix wave (N.5), run the fix wave, re-merge, re-review. **Do not halt.**
- On **NEEDS DISCUSSION** → halt and print findings. This is the one verdict we respect
  in autopilot because it means the issue needs human judgment.
- On 3+ fix iterations on the same set of files → auto-invoke `/brigade:bug-council` on
  the recurring issue. Create fix tasks from the synthesis automatically.
- On 5+ fix iterations on the same task → halt with "autopilot stuck, human intervention
  needed."

Track wave count and pattern progress. Print a short status line before each wave:

```
🚀 Wave {W}  |  {N} tasks  |  models: {list}  |  mode: {full/basic/custom}
```

## Step 3 — Completion

When all waves are complete:

1. Run the full test suite one last time.
2. Verify all task specs have `status: done`.
3. Write sprint learnings to `.planning/learnings.md` (same as `/brigade:run` Step 6).
4. Print a completion summary:

   ```
   ✅ Autopilot complete — {sprint}

   Total duration: {time}
   Waves executed: {N} primary + {N} fix
   Tasks completed: {M}
   Critical findings resolved: {K}
   Tests passing: {all}
   Current branch: {base}

   Ready to open a PR. All merge gates were passed during execution.

   Sprint learnings written to .planning/learnings.md — apply them on the
   next sprint by running /brigade:plan as usual.
   ```

## Halt scenarios (unavoidable)

Autopilot halts (prints diagnostic, exits) only on:

1. **Unresolvable merge conflict** — substantive, not whitespace. Autopilot refuses to
   guess.
2. **`NEEDS DISCUSSION` verdict** from any reviewer.
3. **5+ fix iterations on the same task** without convergence.
4. **Bug Council returns `SAFE` but the same bug reappears** — signal that brigade's
   autonomous reasoning is in a loop.
5. **Test suite catastrophically broken** (0% pass rate after a merge, not just some
   failures). This means something is fundamentally wrong.
6. **API timeout during a critical operation** — Claude Code session may need to be
   restarted. When you come back, run `/brigade:resume` to continue.

Each halt prints a diagnostic report with:
- Current state (wave, task, what's broken)
- Last action attempted
- Suggested next step for the user
- Exact command to resume: `/brigade:resume` or `/brigade:bug-council "..."` or manual

## Hard rules

- **Autonomous mode is not "YOLO mode".** You still respect `isolation: worktree`, still
  require tests, still run the merge gate, still write learnings. The only thing that
  changes is **no user confirmation between steps**.
- **Always write artifacts.** Design doc, ARCHITECTURE.md, learnings.md, review reports,
  sprint summary — all get written. Autopilot ≠ ephemeral.
- **Halt on 5-iteration loops.** Better to stop and tell the user than burn tokens
  forever.
- **Never auto-merge with conflicts.** Trivial conflicts (whitespace, both sides added
  identical lines) can be auto-resolved. Anything substantive halts.
- **API timeouts are not our problem** — if Claude Code session drops, the user has to
  restart it and run `/brigade:resume`. Plugin cannot recover from that alone.
