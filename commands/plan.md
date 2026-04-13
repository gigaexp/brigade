---
description: Plan a feature — brainstorm design, then break into sprint tasks with waves
argument-hint: <feature description or goal>
---

You are running the full planning pipeline for the user's feature request. This command has
TWO phases: first a design phase (brainstorming → spec), then a sprint planning phase
(manager-agent → task specs).

**HARD GATE between phases:** No sprint planning until the user approves the design.

## Preflight

1. Verify `.planning/tasks/ROLES.md` exists. If missing, tell the user to run `/brigade:init` first and stop.

2. **Check for `.planning/ARCHITECTURE.md`.** If missing AND the project already has source code (any of: `src/`, `apps/`, `packages/`, `lib/`, `cmd/`, `pkg/` exists with files inside), this is a brownfield project that hasn't been onboarded yet. Tell the user:

   ```
   No .planning/ARCHITECTURE.md found, but this project has existing code.

   manager-agent plans tasks much better when it knows the codebase layout.
   Strongly recommended: run `/brigade:onboard` first to scan the project
   and produce ARCHITECTURE.md (~30 seconds).

   Skip onboarding and continue anyway? (yes / no)
   ```

   If user says no → stop and let them run onboard.
   If user says yes → proceed without ARCHITECTURE.md, but warn manager-agent in the spawn prompt that ARCHITECTURE.md is missing so it makes more conservative decisions.

   For greenfield projects (no source code yet), skip this check — there's nothing to map.

3. `manager-agent` (used in phase 2) is a **planner only** — it writes task specs and updates the sprint `_README.md`. It never spawns workers. Execution is `/brigade:run`'s job at the top level.

## Decision — does this need a design phase?

Parse `$ARGUMENTS` and branch:

**Case A — file reference (skip design).** The argument is a single `@path/to/file.md` reference:
- `/brigade:plan @./prd.md`
- `/brigade:plan @.planning/specs/existing.md`
- `/brigade:plan @~/Dropbox/features/checkout.md`

Action:
1. Read the file content.
2. **Print a notice to the user** explaining what's happening so they're not surprised:
   ```
   Detected file reference: {path}

   Treating it as an approved design doc — skipping phase 1 (brainstorming).
   Going straight to phase 2 (sprint planning with manager-agent).

   If you wanted to brainstorm a new design instead, cancel and run
   `/brigade:plan <feature description>` (without @ prefix).
   ```
3. Treat the file as the approved design doc. Skip phase 1 entirely.
4. Go to phase 2 with this file as the spec source.

**Case B — explicit `--skip-design` flag.** The user passed `--skip-design` along with
a spec reference. Same as Case A: read the spec, skip phase 1.

**Case C — trivially small task.** The argument describes a typo fix, config tweak, or
single-file bug fix. Suggest the user run `/brigade:fix` instead. If they insist on `/brigade:plan`,
proceed to phase 1 but keep it minimal.

**Case D — matching existing spec.** An existing spec in `.planning/specs/` has a filename
that matches the feature name in $ARGUMENTS. Ask: "Found existing spec at {path}. Use it,
or write a new one?" If use → Case A. If new → Case E.

**Case E — new feature (default).** The argument is freeform feature description and no
matching spec exists. Proceed to phase 1 (design) first. This is the normal path.

---

# Phase 1 — Design

Collaborative brainstorming. Produces a design doc that phase 2 will consume.

**HARD GATE:** Do NOT write code, create files (except the design doc), run commands, or
invoke `manager-agent` until the user has approved the design.

## Step 1 — Understand context

Before asking questions:

1. Read `.planning/ARCHITECTURE.md` if it exists — understand what's already built.
2. Read `.planning/tasks/ROLES.md` — understand available roles.
3. Read `CLAUDE.md` — understand project conventions.
4. Glance at recent git log — understand current momentum.

If `.planning/ARCHITECTURE.md` doesn't exist, suggest running `/brigade:onboard` first for large projects. For small projects, scan the structure yourself quickly.

## Step 2 — Clarifying questions

Ask questions **one at a time**. Focus on:

- **What problem does this solve?** (not what to build — why to build it)
- **Who uses this?** (end user, developer, internal service)
- **What does success look like?** (concrete acceptance criteria)
- **What are the constraints?** (performance, compatibility, timeline, existing tech choices)
- **What's out of scope?** (explicitly exclude to prevent creep)

Prefer multiple-choice questions when possible. Don't quiz — 3-5 questions max for most features.
Stop asking when you can clearly articulate what to build and why.

## Step 3 — Propose approaches

Present **2-3 approaches** with trade-offs:

```
## Approach A: {name}
{2-3 sentences: what it does, key technical choice}
+ {pro}
+ {pro}
- {con}

## Approach B: {name}
...

**Recommendation:** Approach {X} because {reason}.
```

Wait for the user to pick or suggest modifications.

## Step 4 — Present the design

After the user picks an approach, present the full design in sections. Ask after each major
section whether it looks right — don't dump everything at once.

Cover:

1. **Goal** — one sentence
2. **Architecture** — which modules change, new modules, how they connect
3. **Data model** — new types, schemas, migrations (if applicable)
4. **API/Interface** — endpoints, component props, CLI flags (if applicable)
5. **Error handling** — what can go wrong, how to handle it
6. **Testing strategy** — what to test, how (unit, integration, e2e)
7. **Roles involved** — which dev agents will handle which parts

Scale each section to complexity. A simple feature needs 1-2 sentences per section.

## Step 5 — Write design doc

After the user approves the design, write it to:

```
.planning/specs/{date}-{feature-slug}.md
```

Format:

```markdown
# {Feature Name} — Design

**Date:** {YYYY-MM-DD}
**Status:** approved

## Goal

{one sentence}

## Approach

{chosen approach with rationale}

## Architecture

{modules, components, data flow}

## Roles

| Role | Responsibility |
|---|---|
| {agent} | {what it builds} |

## Acceptance criteria

- [ ] {criterion 1}
- [ ] {criterion 2}

## Out of scope

- {explicit exclusion}

## Open questions

- {anything unresolved — address in planning}
```

Create `.planning/specs/` if it doesn't exist.

## Step 6 — Ask permission to proceed to sprint planning

Print:

```
Design saved to .planning/specs/{file}.md

Ready to break this into sprint tasks with manager-agent? (yes / no)
- yes → proceed to phase 2
- no → stop here, you can run `/brigade:plan --skip-design @.planning/specs/{file}.md` later
```

Wait for explicit `yes`. If `no`, stop and report that design is saved.

---

# Phase 2 — Sprint planning

Spawn `manager-agent` to break the approved design into atomic task specs and waves.

**Spec source:** the design doc path to pass to manager-agent comes from:
- Phase 1 just ran → the file you just wrote in step 5 (`.planning/specs/{date}-{slug}.md`)
- Case A (file reference) → the `@path` the user provided
- Case B (`--skip-design`) → the spec path from the flag

Call the Agent tool with:
- `subagent_type`: `manager-agent`
- `isolation`: `none`
- `description`: `Plan sprint from design: {feature-name}`
- `prompt`:
  ```
  Plan the next sprint from an approved design doc.

  Design doc: {spec-path-from-above}

  Follow your `plan` workflow:
  1. Read the design doc above in full.
  2. Read .planning/tasks/ROLES.md and the project CLAUDE.md.
  3. Read .planning/ARCHITECTURE.md if it exists.
  4. Decompose the design into atomic tasks (≤ 5–7 files, one role, one session).
  5. Write each task spec under .planning/tasks/sprint-N/ in the standard format.
  6. Build the file map.
  7. Assign waves (no file overlap inside a wave).
  8. Update sprint-N/_README.md with goal, waves, file map, merge order, and a
     reference to the design doc.
  9. Verify: no file overlap in any wave, every task has a valid role and Required Tests.

  Do NOT spawn any workers. Do NOT write any feature code. Only produce the plan.
  Return a one-paragraph summary with the sprint number, task count, wave count,
  and the tasks in wave 1.
  ```

After manager returns, relay its summary to the user verbatim and suggest `/brigade:run` as the next step.

## Hard rules

- **Phase 1 HARD GATE is real.** No code, no scaffolding, no manager-agent until design is approved.
- **One question per message in phase 1.** Don't overwhelm with a quiz.
- **Always present alternatives.** Even if one approach is clearly better, show at least one other option.
- **Don't gold-plate the design.** This is a working document for `manager-agent`, not a PRD for stakeholders. Keep it actionable.
- **Respect existing stack choices.** Don't propose switching frameworks unless the user raises it.
- **Phase 2 never writes feature code.** Only task specs and sprint README.
