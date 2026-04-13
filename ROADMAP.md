# brigade — roadmap

Planned improvements and known gaps. Grouped by feature.

## Autopilot (deferred)

> **Status: reverted in 1.8.0, deferred until brigade core is battle-tested.**
>
> An initial `/brigade:autopilot` implementation shipped in 1.7.0 but was removed in 1.8.0
> before ever running on a real project. Reason: the feature depends on solid foundations
> (`/brigade:resume`, `/brigade:status`, `/brigade:bug-council`) that themselves haven't
> been production-tested. Shipping autopilot on top of untested commands multiplies risk.
>
> The design below is preserved as a blueprint for when we come back to it.

The original plan was to ship `/brigade:autopilot` as a walk-away mode: launch with a
spec, come back when it's done or stuck. Before that can work for real, these items must
be addressed.

### Critical (must have for true walk-away)

- [ ] **End-to-end testing on a real project.** Run `/brigade:autopilot` on a greenfield
      fullstack project (something like url-shortener) and watch it complete without
      intervention. Capture what breaks and fix it before marketing the feature.

- [ ] **API timeout recovery.** If Claude Code session dies mid-run (stream idle timeout,
      network drop, OOM), there's no way to auto-continue. Options:
      - Bash wrapper script that loops `claude -p "/brigade:resume"` until sprint complete
      - Integration with the `loop` skill (from claude-code ecosystem) for self-scheduling
      - Watchdog hook that restarts the session automatically
      Pick one and implement. Without this, "walk away for hours" isn't real.

- [ ] **Persistent autopilot state.** Currently autopilot tracks fix iterations per task
      in conversation context only. If session dies, the counter resets. Need
      `.planning/autopilot-state.json` tracking:
      - Current wave
      - Fix iteration counts per task
      - Bug Council invocations
      - Total runtime
      - Last checkpoint timestamp
      Loaded on resume so loop detection survives session restart.

- [ ] **Graceful cancel.** User comes back, sees autopilot running, wants to stop without
      losing progress. Right now ctrl+c kills the session and loses context. Need:
      - Periodic checkpointing to git (commit intermediate state every N minutes)
      - Resume-safe cancellation (mark state as "paused, user cancelled", resume picks up)

### Important (quality of experience)

- [ ] **Bug Council synthesis → fix tasks parser.** The spec says
      "auto_apply_bug_council: true creates fix tasks from synthesis" but the exact
      mechanism is hand-wavy. Need:
      - Parser that reads `bug-council/{timestamp}/synthesis.md`
      - Extracts the "Recommended fix" + "Mandatory regression tests" sections
      - Turns them into task specs via manager-agent with explicit prompt
      - Writes specs to `.planning/tasks/sprint-N/` as a new fix wave

- [ ] **Merge conflict classifier.** Currently run.md says "trivial conflicts auto-resolve,
      substantive halt" but there's no concrete algorithm. Need:
      - Whitespace-only conflicts → auto-resolve (git merge -X ours/theirs with check)
      - Both sides added identical lines → auto-resolve (take one)
      - Same file, non-overlapping regions → try git rerere first
      - Anything else → halt and print conflict markers
      Code this as a bash helper script in `hooks/` or inline in run.md.

- [ ] **Test failure severity threshold.** "Catastrophic failure halts, some failures
      investigate" — but where's the line? Propose:
      - Previous run passed + new run has 0% → catastrophic, halt
      - Previous run passed + new run has any failures → treat as REQUEST CHANGES, create fix wave
      - Previous run had failures + new run has more → halt (regression)
      Document and implement in merge gate.

- [ ] **Progress reporting during long runs.** Currently user can only see progress by
      tailing the terminal. For autopilot runs that last hours, need:
      - Append-only log to `.planning/autopilot.log` with timestamps per step
      - Option to spawn `/brigade:status` from another terminal and see live state
      - Webhook/Slack notification on wave complete / halt / sprint complete
      Maybe start with just the log file and polish later.

### Nice to have (polish)

- [ ] **Dry-run mode** — `/brigade:autopilot --dry-run @file.md` shows what would happen
      (planning output, wave breakdown, estimated cost) without actually executing.

- [ ] **Cost tracking in autopilot** — show running $ estimate per wave and total. Pulls
      from per-task token counters. Useful for deciding when to stop long runs.

- [ ] **Concurrency limits** — don't spawn more than N parallel workers if system is
      resource-constrained. Read from `config.autonomous.max_parallel_workers`.

- [ ] **Auto-commit interval** — commit intermediate state to git every N minutes so
      progress isn't lost on crash. Independent of task/wave boundaries.

- [ ] **Completion notifications** — email / Slack / Discord webhook when autopilot
      finishes. Config via `.planning/config.json` `notifications.on_complete`.

### Known limitations (may never fix)

- **Claude Code session death** — if CC crashes (OOM, plugin load error, tool SDK issue),
  brigade cannot recover from that alone. User must manually restart CC and run
  `/brigade:resume`. A bash wrapper partially mitigates this but doesn't handle CC bugs.

- **API rate limits** — autopilot runs many parallel agents + Bug Council spawns +
  model escalations. On a heavy project this can hit rate limits. We can't detect or
  recover from this cleanly — need to fail loudly with a message like "API rate limited,
  wait X minutes and run /brigade:resume".

- **Subagent tool permissions** — each spawned worker may ask for tool approvals. In
  autonomous mode the parent session has pre-approved permissions, but subagents
  inherit a different permission context. This is a Claude Code quirk, not brigade.

## Other features (not autopilot)

### Reviewer specialists
- [ ] Add `security-reviewer` specialist for auth/crypto/secret handling diffs
- [ ] Add `a11y-reviewer` specialist for ARIA/keyboard/contrast checks on UI diffs
- [ ] Make the specialists extensible via `.claude/agents/brigade-*.md` project-level overrides

### Bug Council
- [ ] Tested only via theory — never run on a real hard bug. Needs battle-testing.
- [ ] `performance-analyst` as a 6th diagnostic (profiling, algorithmic complexity, memory)
- [ ] Configurable council size via `config.bug_council.agents`

### Visual regression (deferred from original scope)
- [ ] Playwright screenshot diff for designer-agent
- [ ] Baseline storage in `.planning/visual-baselines/`
- [ ] Integration with merge gate — require approval on visual diff > threshold

### Untested commands (existing since 1.0)
- [ ] `/brigade:resume` — written but never actually run
- [ ] `/brigade:status` — written but never actually run
- [ ] `/brigade:bug-council` — written but never actually run as standalone invocation

### Docs & onboarding
- [ ] `examples/url-shortener/` in the repo with real output from a test sprint
- [ ] Demo GIF or asciinema recording in README
- [ ] `docs/commands/<name>.md` — per-command deep dive
- [ ] `docs/troubleshooting.md` — common issues (permission prompts, API timeouts, stale statusline)
- [ ] CONTRIBUTING.md with agent format, task spec format, review gate invariants

### Sprint learnings depth
- [ ] Track learnings as structured JSON (not just markdown) so they can be filtered by
      age, type, severity when the planner reads them
- [ ] Auto-archive old learnings (>30 days, if not recurring)
- [ ] Show learnings summary in `/brigade:status` dashboard

### Per-task model override via ROLES.md
- [ ] Add `model: sonnet | opus | haiku` field support (documented in 1.4.0 but not
      actually consumed by /brigade:run when spawning workers)

## Stretch goals (far future)

- [ ] Multi-sprint planning — `/brigade:plan` for a milestone spanning 3 sprints with
      dependencies across them
- [ ] Cross-project learnings — pull patterns from other projects' learnings.md into
      the current sprint's planner context
- [ ] Slack/Discord bot integration — post sprint progress, ask for confirmations remotely
- [ ] Web dashboard (like TeamClaude) — but only if the core is rock solid first
