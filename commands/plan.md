---
description: Plan a feature — brainstorm design, then break into sprint tasks with waves
argument-hint: "[--auto-approve] [--skip-design] <feature description | @file.md>"
---

You are running the full planning pipeline for the user's feature request. This command has
TWO phases: first a design phase (brainstorming → spec), then a sprint planning phase
(manager-agent → task specs).

**HARD GATE between phases:** No sprint planning until the user approves the design.

## Mode detection

Check `$ARGUMENTS` for these flags:

- `--auto-approve` — autopilot mode. Skip all HARD GATEs:
  - Design approval is assumed (phase 1 still runs, writes the spec, but doesn't wait for user "yes")
  - Architecture approval is assumed (Step 6 still runs, writes ARCHITECTURE.md, but doesn't wait)
  - Pre-phase-2 confirmation is assumed (Step 7 skipped)
  - Phase 1 clarifying questions still happen, but phrased as statements: "I will assume X. Say 'no' if that's wrong, otherwise I'll continue in 5 seconds."
  - Design doc and ARCHITECTURE.md still get written — they're artifacts, not gates
  - You still ask questions about **genuinely ambiguous** gaps (unspecified tech choices with no reasonable default)

- `--skip-design` — skip phase 1 entirely. Requires a `@file.md` reference. Go straight to phase 2 with the file as the spec source. (Existing behavior, preserved.)

Also read `.planning/config.json`. If `config.autonomous.enabled === true`, treat it as if
`--auto-approve` was passed.

## Preflight

1. Verify `.planning/tasks/ROLES.md` exists. If missing, tell the user to run `/brigade:init` first and stop.

2. **Architecture must always be agreed before sprint planning.** Check for
   `.planning/ARCHITECTURE.md`:

   - **Brownfield (project has source code in `src/`, `apps/`, `packages/`, `lib/`,
     `cmd/`, `pkg/`) AND no ARCHITECTURE.md** → tell the user to run `/brigade:onboard`
     first, stop. The architecture must be mapped from existing code before tasks can
     be planned.

   - **Greenfield (no source code yet) AND no ARCHITECTURE.md** → DO NOT skip. Instead,
     tell the user that architecture will be agreed as part of phase 1 (design phase).
     Phase 1 will propose the project architecture from the spec, get user approval,
     and write it to `.planning/ARCHITECTURE.md` BEFORE phase 2 runs. Set an internal
     flag `needs_architecture = true` for use in phase 1.

   - **ARCHITECTURE.md exists** → no action, proceed.

   The principle: manager-agent must always have an agreed architecture document to
   read. No exceptions for greenfield, no silent skips, no "trust me bro" planning.

3. `manager-agent` (used in phase 2) is a **planner only** — it writes task specs and updates the sprint `_README.md`. It never spawns workers. Execution is `/brigade:run`'s job at the top level.

## Decision — phase 1 mode

**Phase 1 (design / brainstorming) is ALWAYS run by `/brigade:plan`** — even when the
user provides a file reference. The file becomes input to brainstorming, not a bypass.

There is exactly one escape hatch: `--skip-design` flag. Otherwise phase 1 always happens.

Parse `$ARGUMENTS` and branch:

**Case A — file reference (input to brainstorming).** The argument is a single
`@path/to/file.md` reference:
- `/brigade:plan @./prd.md`
- `/brigade:plan @.planning/specs/existing.md`
- `/brigade:plan @~/Dropbox/features/checkout.md`

Action:
1. Read the file content fully.
2. **Print a notice to the user:**
   ```
   Detected file reference: {path}

   Reading it as input to design phase. I'll review it for gaps, ask any
   clarifying questions, and refine sections that need it. The file is a
   starting point, not a final spec — we'll lock the final design at the
   end of phase 1.

   If you want to skip brainstorming entirely and use the file as-is,
   cancel and run `/brigade:plan --skip-design @{path}`.
   ```
3. Enter phase 1, but with the file content already in your context. Use it to:
   - **Skip generic context-gathering questions** that the file already answers
   - **Identify gaps** the file doesn't cover (error handling not specified, no acceptance criteria, ambiguous requirements)
   - **Ask only about the gaps** (max 3-5 targeted questions)
   - **Propose alternatives** if the file has obvious tradeoffs not discussed
   - **Refine and finalize** — write the approved design doc as a new file in `.planning/specs/`
4. The HARD GATE still applies: no phase 2 until user approves the refined design.

**Case B — explicit `--skip-design` flag.** The user explicitly opted out of brainstorming:
`/brigade:plan --skip-design @path/to/spec.md`

Action:
1. Read the file as the final approved spec.
2. Print: "Skipping design phase per --skip-design flag. Going straight to sprint planning."
3. Skip phase 1 entirely. Go to phase 2 with this file as the spec source.

This is the **only** way to bypass phase 1 with `/brigade:plan`. (For bug fixes, use
`/brigade:fix` which is designed without a design phase.)

**Case C — trivially small task.** The argument describes a typo fix, config tweak, or
single-file bug fix. Suggest the user run `/brigade:fix` instead. If they insist on
`/brigade:plan`, proceed to phase 1 but keep it minimal.

**Case D — matching existing spec.** An existing spec in `.planning/specs/` has a filename
that matches the feature name in $ARGUMENTS. Ask: "Found existing spec at {path}. Use it
as input to brainstorming, or start fresh?" If use → Case A. If fresh → Case E.

**Case E — new feature (default).** The argument is freeform feature description and no
file reference. Proceed to phase 1 from scratch.

---

# Phase 1 — Design

Collaborative brainstorming. Produces a design doc that phase 2 will consume.

**HARD GATE:** Do NOT write code, create files (except the design doc), run commands, or
invoke `manager-agent` until the user has approved the design.

## Step 1 — Understand context

Before asking questions:

1. **If Case A** (file reference) — the file content is already in your context from
   the decision step. Treat it as the user's draft spec.
2. Read `.planning/ARCHITECTURE.md` if it exists — understand what's already built.
3. Read `.planning/tasks/ROLES.md` — understand available roles.
4. Read `CLAUDE.md` — understand project conventions.
5. Glance at recent git log — understand current momentum.

If `.planning/ARCHITECTURE.md` doesn't exist, suggest running `/brigade:onboard` first for large projects. For small projects, scan the structure yourself quickly.

## Step 2 — Clarifying questions

**Case A (file provided) mode:** Don't ask questions the file already answers. Read the
file critically, then ask **only about gaps**:
- Acceptance criteria not specified
- Error handling not described
- Ambiguous requirements ("should be fast" — how fast?)
- Missing edge cases the spec doesn't cover
- Unclear tech choices (the spec says "use a database" — which one?)
- Out-of-scope items not explicitly excluded

Max 3-5 targeted questions. If the file is comprehensive and you have no real questions,
say so and proceed to step 3.

**Case E (no file) mode:** Run a full discovery — see questions below.

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

## Step 6 — Architecture agreement (mandatory if `needs_architecture` flag set)

If preflight set `needs_architecture = true` (greenfield project, no ARCHITECTURE.md
exists), generate and get approval on the project architecture **before** proceeding
to phase 2. This step is non-negotiable — manager-agent must always have an approved
architecture document.

If `.planning/ARCHITECTURE.md` already exists, skip this step.

### Step 6a — Propose architecture

Based on the approved design doc (the one you just wrote in Step 5), propose the project-level
architecture. Read the design's "Approach" and "Architecture" sections and expand into a
machine-readable map for manager-agent.

Present this to the user **section by section**, asking for approval after each section. Don't
dump the whole thing at once.

Cover:

1. **Project type** — `single-app` / `monorepo` / `multi-service` / `library`
2. **Modules** — for each planned module:
   - Name and path (e.g. `apps/api/`, `apps/web/`)
   - Tech stack (language, framework, key libraries)
   - Role that owns it (frontend, designer, nodejs, golang, devops)
   - Entry point (e.g. `src/server.ts`, `src/main.tsx`)
   - Test framework and command
3. **Dependencies between modules** — how they communicate (REST, shared types, message queue)
4. **Shared resources** — database, API contracts, shared types directory, CI/CD location
5. **Build & run commands** — what the user will type to start dev/test/build
6. **Notes for planning** — known coupling, files that change together, perf-sensitive paths

### Step 6b — Write `.planning/ARCHITECTURE.md`

After the user approves all sections, write the file in this exact format:

```markdown
# Architecture

> Approved on {date} during /brigade:plan phase 1. Update with /brigade:onboard
> after sprints complete to refresh from real code, or edit by hand.

## Project type

{type}

## Modules

### {module-name}
- **Path:** `{path}/`
- **Stack:** {language}, {framework}, {key libs}
- **Role:** {agent-name}
- **Entry:** `{entry-file}`
- **Tests:** `{test-command}` ({framework})

### {next module}
...

## Dependencies

{module-a} → {module-b}: {how they communicate}
...

## Shared resources

- **Database:** {type, schema location or "none"}
- **API contracts:** {OpenAPI spec, proto files, shared types path, or "none"}
- **CI/CD:** {tool, config location, or "none"}

## Build & run

| Command | What it does |
|---|---|
| `{command}` | {description} |

## Notes for planning

{anything manager-agent should know — known coupling, hot paths, etc.}
```

Commit the file: `git add .planning/ARCHITECTURE.md && git commit -m "docs: agree initial architecture"`.

### Step 6c — Confirm and proceed

Print:

```
Architecture saved to .planning/ARCHITECTURE.md

Ready to break the design into sprint tasks with manager-agent? (yes / no)
- yes → proceed to phase 2
- no → stop here, you can run `/brigade:plan --skip-design @.planning/specs/{spec}.md`
        later when ready
```

Wait for explicit `yes`. If `no`, stop and report that design + architecture are saved.

## Step 7 — Ask permission to proceed to sprint planning

(Only if Step 6 was skipped because ARCHITECTURE.md already exists.)

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
- **Architecture must always be agreed before phase 2.** No silent skips for greenfield. If `.planning/ARCHITECTURE.md` doesn't exist, generate it from the design and get user approval before spawning manager-agent.
- **One question per message in phase 1.** Don't overwhelm with a quiz.
- **Always present alternatives.** Even if one approach is clearly better, show at least one other option.
- **Don't gold-plate the design.** This is a working document for `manager-agent`, not a PRD for stakeholders. Keep it actionable.
- **Respect existing stack choices.** Don't propose switching frameworks unless the user raises it.
- **Phase 2 never writes feature code.** Only task specs and sprint README.
