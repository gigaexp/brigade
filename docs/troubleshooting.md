# Troubleshooting

Common issues and how to fix them.

## Statusline disappeared after plugin upgrade

**Symptom.** After running `claude plugin update brigade@gigaexp` the custom status
line (showing model, sprint, context bar) is gone. Default Claude Code status line is shown instead.

**Cause.** In brigade < 1.6.1 the `setup-statusline` hook wrote an absolute path to
the plugin cache directory (e.g. `.../cache/brigade/brigade/1.4.1/hooks/statusline.cjs`)
into `.claude/settings.json` on first session. When the plugin was upgraded, the old
cache dir was deleted but the path in `settings.json` still pointed to it. Claude Code
tried to execute a non-existent file and silently fell back.

**Fix.** Upgrade to brigade 1.6.1+. The `setup-statusline` hook now detects its own stale
cache paths and rewrites them to the current `CLAUDE_PLUGIN_ROOT` on every session start.

If you are already on 1.6.1+ and still see the issue, delete the statusLine field from
`.claude/settings.json` manually:

```bash
# Edit .claude/settings.json and remove the "statusLine" key
# Then restart Claude Code — the hook will recreate it with the correct path
```

## Workers branched into main tree instead of isolated worktrees

**Symptom.** After `/brigade:run`, multiple workers stomped on each other's files, merge
conflicts appeared immediately, or tests that passed individually fail after merge.

**Cause.** brigade < 1.8.1 had a hard rule to use `isolation: worktree` on every Agent
call, but the rule was easy to accidentally skip during fix waves and model escalation
retries. Workers would run in the main tree directly, stomping on parallel workers.

**Fix.** Upgrade to brigade 1.8.1+. `/brigade:run` now has explicit enforcement:
`isolation: worktree` is **mandatory** on every Agent call, with an explicit verification
step before each spawn. Hard rule added.

## API stream idle timeout mid-run

**Symptom.** During `/brigade:run`, the session receives an `API Error: Stream idle
timeout - partial response received` error, and execution stops.

**Cause.** Claude API has an idle timeout on streamed responses. If the model takes too
long between tokens (deep thinking phase, many parallel tool calls queuing up, or
Anthropic's servers are under load), the connection gets dropped.

**Fix.** Run `/brigade:resume`. This command auto-detects the sprint state and continues
from where it stopped. It handles five scenarios:

- Status drift — commits exist on main but task specs still say `todo`, sync them
- Outstanding branches — unmerged worker branches, merge them through the review gate
- Clean state but next wave pending — offer to run the next wave
- Sprint complete — run final verification + write learnings
- Conflicting state — halt with diagnostic, don't guess

Work that was already committed to worker branches is not lost.

## Permission prompts blocking autonomous runs

**Symptom.** During `/brigade:run`, you get an interactive "Allow this tool call?" prompt
for every `Bash(git:*)`, `Bash(npm test:*)`, `Write(...)`, etc. If you walk away from the
terminal, execution halts.

**Cause.** Claude Code permission system defaults to "ask each time" for anything that
could write files or run commands.

**Fix.** Pre-approve permissions in `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(git:*)",
      "Bash(npm:*)",
      "Bash(pnpm:*)",
      "Bash(yarn:*)",
      "Bash(node:*)",
      "Bash(go:*)",
      "Bash(cargo:*)",
      "Write(**)",
      "Edit(**)"
    ]
  }
}
```

This is a one-time Claude Code configuration, not a brigade setting. It applies globally
to any project.

## `/brigade:plan @file.md` silently skipped the design phase

**Symptom.** You ran `/brigade:plan @prd.md` expecting brainstorming to happen, but it
went straight to sprint planning without asking any questions.

**Cause.** In brigade < 1.5.0 the `@file.md` syntax was treated as a bypass — phase 1
was skipped entirely and the file was used as-is.

**Fix.** Upgrade to brigade 1.5.0+. `@file.md` is now **input** to brainstorming, not a
bypass. Phase 1 reads the file and asks only about gaps (max 3-5 targeted questions).

If you genuinely want to bypass brainstorming — use the explicit flag:

```bash
/brigade:plan --skip-design @prd.md
```

Or use `/brigade:fix` for bug fixes, which is designed without a design phase.

## Sprint planning on greenfield project skipped architecture agreement

**Symptom.** `/brigade:plan @prd.md` on an empty project went straight to
`manager-agent` without producing or approving `.planning/ARCHITECTURE.md`.

**Cause.** In brigade < 1.6.0 the preflight check for `ARCHITECTURE.md` silently skipped
greenfield projects ("nothing to map"). But manager-agent needed architectural decisions
to decompose tasks well.

**Fix.** Upgrade to brigade 1.6.0+. Greenfield projects now trigger a new Step 6
"Architecture agreement" in phase 1 — brigade generates a project architecture from the
design doc, presents it section by section for user approval, and writes it to
`.planning/ARCHITECTURE.md` before sprint planning runs.

## Manager-agent uses opus for every task, even simple ones

**Symptom.** Every worker task is dispatched with `model: opus`, burning through token
budget fast.

**Cause.** In brigade < 1.4.0 `manager-agent` and `devops-agent` defaulted to opus, and
the run.md model selection table picked opus too eagerly for "complex-looking" tasks.

**Fix.** Upgrade to brigade 1.4.0+. Only `manager-agent` (the planner) stays on opus —
one invocation per sprint. All workers default to sonnet. Power users can override
per-role in `ROLES.md` with `model: opus` or per-task in spec frontmatter.

## `brigade@claude-research` and `brigade@gigaexp` both show in plugin list

**Symptom.** `claude plugin list` shows two brigade entries — one from local marketplace
(`claude-research`) and one from public (`brigade`). Duplicates get confusing.

**Cause.** During brigade development we maintained two marketplaces: a local one for
development (`claude-research`) and a public one (`gigaexp/brigade`). If both are added
and both had brigade installed, `claude plugin list` shows both.

**Fix.** Pick one and uninstall the other:

```bash
# To keep only the public one:
claude plugin uninstall brigade@claude-research --scope project
# (repeat per project where it was installed)

# Or the opposite:
claude plugin uninstall brigade@gigaexp --scope user
```

The duplicates are cosmetic — neither blocks the other from working. Claude Code uses
whichever is enabled in the current scope.

## Task specs are missing Shared contracts / Failure modes sections

**Symptom.** Task specs generated by manager-agent don't have the `## Shared contracts`
or `## Failure modes` sections, even though you expected them.

**Cause.** In brigade < 1.2.0 these sections didn't exist in the task spec template.

**Fix.** Upgrade to brigade 1.2.0+. Manager-agent now writes both sections when
applicable:

- **Shared contracts** — mandatory when 2+ parallel tasks share types/schemas (prevents
  contract drift between workers)
- **Failure modes** — mandatory for any non-trivial logic (prevents silent failures that
  the worker self-audit misses)

Required Tests now maps 1:1 to failure modes.

## `/brigade:run` halts on critical review findings — can it auto-fix instead?

**Symptom.** A fan-out reviewer flagged critical issues and `/brigade:run` halted. You
want brigade to create fix tasks automatically and continue.

**Status.** This was originally planned as part of autopilot mode (1.7.0), but autopilot
was reverted in 1.8.0 pending core battle-testing. For now, you have to manually run
`/brigade:plan` on the findings or run `/brigade:fix` for each.

The feature is on the [roadmap](../ROADMAP.md) — will return when `/brigade:resume`,
`/brigade:status`, and `/brigade:bug-council` have been validated on real projects.

## Plugin updated but commands still show old behavior

**Symptom.** `claude plugin list` shows the new version, but `/brigade:plan` or other
commands behave like the old version.

**Cause.** Claude Code loads command files at session start. Updating the plugin doesn't
reload commands in the current session.

**Fix.** Restart Claude Code:

```bash
/exit
# then from your terminal:
claude
```

The new command files will be loaded on the next session start.

## Still stuck?

Open an issue at https://github.com/gigaexp/brigade/issues with:

1. brigade version (`/brigade:version` or `.claude-plugin/plugin.json`)
2. Claude Code version (`claude --version`)
3. What command you ran
4. Expected vs actual behavior
5. Relevant contents of `.planning/` (task specs, review reports, learnings)
