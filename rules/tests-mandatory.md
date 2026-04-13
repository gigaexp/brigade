# Tests — mandatory acceptance gate

Opinionated rule: any non-trivial change ships with tests, or it is not accepted.
Import from your project's `CLAUDE.md`:

```markdown
@~/.claude/plugins/brigade/rules/tests-mandatory.md
```

## Rules

- **Unit tests** for new pure functions, stores, reducers, utilities.
- **Component tests** (Vitest + Testing Library, or whatever the project uses) for new UI components with logic.
- **E2E tests** (Playwright) for new user-visible flows — new pages, new critical interactions.
- **Accessibility smoke tests** for interactive components (role, label, keyboard navigation).
- Tests live next to the code they test unless the project convention says otherwise.
- Run the full test suite before committing. Existing failures unrelated to your change → document as a blocker, don't silence them.

## When tests are NOT required

- Pure documentation / README changes.
- Config-only changes that have no behavior.
- Trivial typo fixes.
- Throwaway scripts in `scripts/` clearly marked as one-off.

## Acceptance gate

No tests on code changes that require them = work is not accepted. This is the hard line.
Inside the sprint workflow, this rule is enforced by the manager at merge time.
