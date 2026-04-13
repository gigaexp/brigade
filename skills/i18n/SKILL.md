---
name: i18n
description: Internationalization rules for react-i18next projects. Use when editing i18n JSON files, adding translation keys, or fixing missing translations. Triggers on i18n, translation, locale, en.json, ru.json work.
---

# i18n Rules

## Shared JSON Files Are High-Conflict

i18n JSON files (`en.json`, `ru.json`, etc.) are modified by many tasks. When editing:

1. **Surgical edits only.** Never rewrite the entire file or large blocks. Add/rename only the specific keys you need.
2. **Never delete keys** unless the task explicitly requires it. Other code may reference them.
3. **Always add to ALL locale files** simultaneously. If you add a key to `en.json`, add it to `ru.json` too (and vice versa).
4. **Verify key references before renaming.** `grep -r "old.key.name" src/` to find all usages. Update code references or keep the old key as alias.

## Key Naming Convention

Use nested JSON objects with dot-path access:

```json
{
  "section": {
    "subsection": {
      "key": "Value"
    }
  }
}
```

Access: `t("section.subsection.key")`

Pattern: `{feature}.{context}.{label|hint|tooltip|action}`

## Adding Keys Checklist

1. Add key to ALL locale JSON files
2. Use `{{ variable }}` for interpolation: `"greeting": "Hello, {{ name }}"`
3. Run tests — i18n-dependent tests will catch missing keys
4. Check for dead keys: search codebase for removed `t("...")` calls

## Worktree Warning

When working in a git worktree, your copy of i18n files may be outdated. Other tasks may have added keys to main after your branch point. Your edits must be **additive only** — never remove or reorder existing keys.
