---
description: Bug Council — spawn 5 diagnostic specialists in parallel to analyze a hard bug from multiple angles, then synthesize a root cause and fix recommendation
argument-hint: <bug description, file paths, or reference to failing test>
---

You are convening a Bug Council — a team of 5 specialized diagnostic agents who analyze
a hard bug from different angles in parallel, then you synthesize their findings into
a single root cause and fix recommendation.

## When to use

- `/brigade:fix` failed 3+ times on the same bug
- A bug has been fought for an hour+ with no clear root cause
- A bug appears to have multiple possible causes
- A bug keeps coming back after being "fixed"
- You can't reproduce consistently and need multiple perspectives

Do NOT use for simple bugs — `/brigade:fix` is faster and cheaper.

## Preflight

1. Verify the working tree is clean OR the user confirms the current state is expected.
2. Verify `.planning/tasks/ROLES.md` exists (not strictly required, but helps diagnostics).
3. Create `.planning/bug-council/` directory if missing.

## Step 1 — Capture the bug report

Read `$ARGUMENTS`. If it's vague, ask the user ONCE for:
- What's the symptom? (error message, unexpected behavior, failing test)
- How to reproduce?
- Which files do you suspect? (optional)

Write a brief bug report to `.planning/bug-council/{timestamp}-bug.md`:

```markdown
# Bug report

**Date:** {date}
**Symptom:** {what's broken}
**Reproduction:** {steps}
**Suspect files:** {if known}
**Previous fix attempts:** {if any — what was tried, what failed}
```

## Step 2 — Spawn all 5 diagnostic agents in parallel

**CRITICAL: emit all 5 Agent calls in a SINGLE message.** Parallelism only works when
all calls are in the same assistant response.

Each agent gets the same bug report and a role-specific prompt. All 5 write their reports
to distinct files under `.planning/bug-council/{timestamp}/`.

| Agent | Report file | Focus |
|---|---|---|
| `root-cause-analyst` | `root-cause.md` | 4-phase debugging, trace to source |
| `code-archaeologist` | `archaeology.md` | git history, when was this introduced |
| `pattern-matcher` | `patterns.md` | similar bugs elsewhere, working examples |
| `systems-thinker` | `systems.md` | coupling, data flow, invariants |
| `adversarial-tester` | `adversarial.md` | edge cases, assumptions that might break |

Each agent uses `isolation: none` (read-only, no worktree needed) and `model: sonnet`.

Prompt template (adapt per agent):

```
You are analyzing a hard bug as part of a Bug Council. Other specialists are looking at
this same bug from different angles in parallel. Your job is your specialty only.

## Bug report
{paste the bug report}

## Your role
{paste the description from the agent's frontmatter}

## Task
Follow your process exactly as defined in your skill. Do not write fixes — only analyze.

Write your report to: .planning/bug-council/{timestamp}/{your-file}.md

Return a 3-line summary when done.
```

## Step 3 — Wait for all 5, then synthesize

After all 5 reports are written, read each file in full.

Produce a synthesis report at `.planning/bug-council/{timestamp}/synthesis.md`:

```markdown
# Bug Council Synthesis

**Bug:** {one sentence}
**Timestamp:** {date}
**Agents consulted:** 5

## Root cause (high confidence)
{The most likely root cause, based on the convergence of findings.
Cite which agents agreed and why.}

- **File:** {path}
- **Line:** {number or range}
- **Reason:** {one paragraph}

## Evidence supporting this conclusion
1. Root cause analyst found: {specific finding}
2. Code archaeologist found: {specific finding}
3. Pattern matcher found: {specific finding}
4. Systems thinker found: {specific finding}
5. Adversarial tester found: {specific finding}

## Alternative hypotheses (not ruled out)
{Any dissenting findings — if analysts disagree, list both and explain which is more likely}

## Recommended fix
{Concrete fix description — what to change, where, in what order}

## Mandatory regression tests
Before shipping the fix, add tests for:
- [ ] {test for the original symptom}
- [ ] {edge case 1 from adversarial-tester}
- [ ] {edge case 2 from adversarial-tester}
- [ ] {similar bug from pattern-matcher if found}

## Fix scope
- **Single-site fix**: fix only the root cause location
- **Systemic fix**: pattern-matcher found the bug in N other places — fix all
- **Architectural refactor**: systems-thinker flagged coupling that needs rework

Pick one and justify.

## Confidence
{low/medium/high — "high" only if agents converged on the same root cause}
```

## Step 4 — Present to the user

Print a short summary to the user:

```
Bug Council complete ({duration}).

Root cause: {one sentence}
Confidence: {level}
Fix scope: {single-site / systemic / refactor}
Required tests: {N}

Full reports at: .planning/bug-council/{timestamp}/
Synthesis: .planning/bug-council/{timestamp}/synthesis.md

Next step:
- To apply the fix: run `/brigade:fix --from-council {timestamp}` or manually implement from synthesis.md
- To drill deeper: review individual reports
```

Do NOT auto-apply the fix. The user decides.

## Hard rules

- **All 5 agents spawn in parallel.** Single message, 5 Agent tool calls. Never sequential.
- **Read-only council.** No agent writes code. They all analyze.
- **Synthesize, don't summarize.** Look for convergence between agents. Disagreement is a signal.
- **High confidence requires convergence.** If agents point at different root causes, confidence is medium at best.
- **Mandatory regression tests.** Every counterexample from adversarial-tester must become a test.
- **Never auto-apply the fix.** The user reads the synthesis and decides.
