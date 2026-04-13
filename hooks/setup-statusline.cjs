#!/usr/bin/env node
// SessionStart hook — ensures project .claude/settings.json has statusLine pointing to
// the CURRENT brigade plugin cache path. Non-destructive for user-customized statusLine.
//
// How it handles version updates:
// - If no statusLine → write ours pointing at current CLAUDE_PLUGIN_ROOT
// - If statusLine points at a stale brigade cache path (old version, old plugin name) →
//   update it to current CLAUDE_PLUGIN_ROOT
// - If statusLine points at a non-brigade command (user's custom statusline) → leave alone

const fs = require('fs');
const path = require('path');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const cwd = data.cwd || process.cwd();
    const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;

    if (!pluginRoot) process.exit(0);

    const claudeDir = path.join(cwd, '.claude');
    const settingsPath = path.join(claudeDir, 'settings.json');
    const currentStatuslineCmd = `node "${path.join(pluginRoot, 'hooks', 'statusline.cjs')}"`;

    let settings = {};
    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch (e) {
        process.exit(0); // Don't clobber unparseable settings
      }

      if (settings.statusLine) {
        const existing = settings.statusLine.command || '';

        // Detect if existing command points at a brigade (or old dev) plugin cache path.
        // These are the patterns we own and are safe to rewrite when stale:
        //   ~/.claude/plugins/cache/<marketplace>/brigade/<version>/hooks/statusline.cjs
        //   ~/.claude/plugins/cache/<marketplace>/dev/<version>/hooks/statusline.cjs
        //   any absolute path ending in /hooks/statusline.cjs inside a plugin cache
        const isOurStatusline = /\/plugins\/cache\/[^"]+\/(brigade|dev)\/[^"]+\/hooks\/statusline\.cjs/.test(existing);

        if (!isOurStatusline) {
          // User has a custom statusLine — don't touch it
          process.exit(0);
        }

        // It's our statusline from a previous version — check if it's stale
        if (existing === currentStatuslineCmd) {
          // Already current, nothing to do
          process.exit(0);
        }

        // Stale — verify the file actually exists at the old path to be safe
        const match = existing.match(/node "([^"]+)"/);
        if (match && fs.existsSync(match[1])) {
          // Old path still exists (unlikely but possible) — still update to current
          // because the user just started a session and should see the latest version
        }
        // Fall through to update
      }
    }

    // Write current command
    settings.statusLine = {
      type: "command",
      command: currentStatuslineCmd
    };

    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  } catch (e) {
    process.exit(0);
  }
});
