# Example — URL Shortener

This is a reference project showing what `brigade` produces when given a real PRD.

> **Status: input captured, output pending.**
>
> `prd.md` is the exact spec fed to brigade. The `.planning/` directory will be populated
> with real artifacts (design doc, ARCHITECTURE, task specs, reviews, learnings) after
> the reference sprint is run. Until then, placeholders explain what will go there.

## How to read this example

1. **`prd.md`** — the input. A detailed product requirements document for a minimal URL
   shortener with React frontend, Fastify backend, SQLite storage, and designer/frontend
   role split.

2. **`.planning/specs/{date}-url-shortener.md`** — the design doc written during phase 1
   brainstorming. brigade reads the PRD, asks clarifying questions about gaps, proposes
   alternatives, then produces this approved spec.

3. **`.planning/ARCHITECTURE.md`** — the project-level architecture agreed during phase 1
   Step 6. Lists modules, stacks, entry points, test commands, dependencies.

4. **`.planning/tasks/ROLES.md`** — the role → agent mapping (designer, frontend, nodejs).

5. **`.planning/tasks/sprint-1/`** — the sprint breakdown by `manager-agent`:
   - `_README.md` — waves, file map, dependencies
   - `S1.1-*.md`, `S1.2-*.md`, ... — individual task specs with Shared contracts and
     Failure modes sections
   - `reviews/wave-{N}-review-*.md` — reports from each reviewer at the merge gate
   - `reviews/wave-{N}-summary.md` — aggregated verdict

6. **`.planning/learnings.md`** — patterns detected during the sprint: what went well,
   what caused halts, what should change next time.

## How to reproduce

```bash
mkdir my-url-shortener && cd my-url-shortener
git init

claude plugin install brigade@brigade --scope project
# restart Claude Code

/brigade:init             # pick frontend + designer + nodejs + react-basic + nodejs-fastify
/brigade:plan @prd.md     # phase 1 brainstorm → design → architecture → phase 2 sprint
/brigade:run              # execute waves
```

The result should closely match the artifacts in this directory (minor variations in
task decomposition and wording are expected — brigade is non-deterministic).

## What to look for when reading the artifacts

- **Design doc** has explicit acceptance criteria, out-of-scope, open questions resolved.
- **ARCHITECTURE.md** was approved section by section — modules match the design.
- **Task specs** all have `Shared contracts` (because designer + frontend share types)
  and `Failure modes` (because every non-trivial task has failure cases).
- **Reviews** show fan-out in action — generalist + specialists spawned in parallel.
- **Learnings** capture any real issues from the run (if none, the sprint ran clean).

This example is updated after each brigade release to reflect the latest output quality.
