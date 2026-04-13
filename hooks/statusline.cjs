#!/usr/bin/env node
// Dev plugin statusline — shows model, current task, directory, context usage

const fs = require('fs');
const path = require('path');
const os = require('os');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const model = data.model?.display_name || 'Claude';
    const dir = data.workspace?.current_dir || process.cwd();
    const session = data.session_id || '';
    const remaining = data.context_window?.remaining_percentage;

    // Context bar
    const AUTO_COMPACT_BUFFER_PCT = 16.5;
    let ctx = '';
    if (remaining != null) {
      const usableRemaining = Math.max(0, ((remaining - AUTO_COMPACT_BUFFER_PCT) / (100 - AUTO_COMPACT_BUFFER_PCT)) * 100);
      const used = Math.max(0, Math.min(100, Math.round(100 - usableRemaining)));
      const filled = Math.floor(used / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

      if (used < 50) {
        ctx = `\x1b[32m${bar} ${used}%\x1b[0m`;
      } else if (used < 65) {
        ctx = `\x1b[33m${bar} ${used}%\x1b[0m`;
      } else if (used < 80) {
        ctx = `\x1b[38;5;208m${bar} ${used}%\x1b[0m`;
      } else {
        ctx = `\x1b[5;31m💀 ${bar} ${used}%\x1b[0m`;
      }
    }

    // Current task from todos
    let task = '';
    const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
    const todosDir = path.join(claudeDir, 'todos');
    if (session && fs.existsSync(todosDir)) {
      try {
        const files = fs.readdirSync(todosDir)
          .filter(f => f.startsWith(session) && f.endsWith('.json'))
          .map(f => ({ name: f, mtime: fs.statSync(path.join(todosDir, f)).mtime }))
          .sort((a, b) => b.mtime - a.mtime);

        if (files.length > 0) {
          const todos = JSON.parse(fs.readFileSync(path.join(todosDir, files[0].name), 'utf8'));
          const inProgress = todos.find(t => t.status === 'in_progress');
          if (inProgress) task = inProgress.content || '';
          // Truncate long task names
          if (task.length > 40) task = task.substring(0, 37) + '...';
        }
      } catch (e) {}
    }

    // Sprint info
    let sprint = '';
    const cwd = data.cwd || process.cwd();
    try {
      const sprintDirs = fs.readdirSync(path.join(cwd, 'docs', 'tasks'))
        .filter(d => d.startsWith('sprint-'))
        .sort();
      if (sprintDirs.length > 0) {
        sprint = sprintDirs[sprintDirs.length - 1];
      }
    } catch (e) {}

    // Build output
    const dirname = path.basename(dir);
    const parts = [`\x1b[2m${model}\x1b[0m`];
    if (sprint) parts.push(`\x1b[36m${sprint}\x1b[0m`);
    if (task) parts.push(`\x1b[1m${task}\x1b[0m`);
    parts.push(`\x1b[2m${dirname}\x1b[0m`);
    if (ctx) parts.push(ctx);

    process.stdout.write(parts.join(' │ '));
  } catch (e) {
    process.exit(0);
  }
});
