# i18n — react-i18next mandatory

Opinionated rule: every user-facing string in a React project must go through `react-i18next`.
Import from your project's `CLAUDE.md`:

```markdown
@~/.claude/plugins/brigade/rules/i18n-react.md
```

## Rules

- **NEVER hardcode user-facing strings.** Always use `useTranslation()` from `react-i18next`.
- **Every new string must exist in all locale JSON files.** If the project has `en.json` and `ru.json`, add the key to both. Missing keys break runtime.
- Applies to: labels, placeholders, tooltips, error messages, button text, toasts, modal titles, empty states — anything the user reads.
- Keys should be namespaced by feature: `settings.profile.saveButton`, not `saveButton`.
- Use the `i18n` skill for translation key conventions and locale file structure specific to this project.

## What does NOT need translation

- Developer-facing console logs.
- Test fixtures.
- Internal error codes (the human message shown next to them does need translation).
