---
description: Print the brigade plugin version and short changelog pointer
---

Print the current version of the `brigade` plugin and what changed most recently.

Steps:

1. Read `~/.claude/plugins/cache/claude-research/dev/*/\.claude-plugin/plugin.json` — pick the version from whichever install path is active (the directory named after the version, e.g. `0.6.0/`). If multiple versions are cached, the active one is the one that resolved when this command ran — use the `plugin.json` from whatever directory this command file itself lives in (that is always the active install).

2. Print in this exact format:

```
brigade plugin — v{version}

{description from plugin.json}
Author: {author.name}

Install path: ~/.claude/plugins/cache/claude-research/dev/{version}/
```

3. Do not guess the version. If you cannot read plugin.json for any reason, say so explicitly:
```
Could not read plugin.json — install may be corrupted. Reinstall with:
  /plugin uninstall dev@claude-research
  /plugin marketplace update claude-research
  /plugin install dev@claude-research
```

4. Do not print a full changelog — the user can check `git log` in the source repo for that. Just one line: "See claude-research repo git log for full changelog."

## Hard rules

- **Read-only.** This command never writes anything.
- **No guessing.** Version must come from plugin.json on disk, not from memory.
- **Fast.** Three bash commands at most. Do not probe network, do not list all installed plugins.
