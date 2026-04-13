#!/usr/bin/env node
// SessionStart hook — ensures project .claude/settings.json has statusLine pointing to our statusline.cjs
// Only writes if statusLine is not already configured. Non-destructive.

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
    const statuslineCmd = `node "${path.join(pluginRoot, 'hooks', 'statusline.cjs')}"`;

    let settings = {};
    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch (e) {
        process.exit(0); // Don't clobber unparseable settings
      }
      // Already has statusLine — don't overwrite
      if (settings.statusLine) {
        process.exit(0);
      }
    }

    // Add statusLine
    settings.statusLine = {
      type: "command",
      command: statuslineCmd
    };

    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  } catch (e) {
    process.exit(0);
  }
});
