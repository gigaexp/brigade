#!/usr/bin/env node
// Stop Guard — Stop hook
// Prevents workers from abandoning tasks by checking if sprint has pending work.
// Advisory only — warns but does not block (Claude Code Stop hooks can't block exit).

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

    // Check if we're in a sprint context
    const tasksDir = path.join(cwd, 'docs', 'tasks');
    if (!fs.existsSync(tasksDir)) process.exit(0);

    // Find current sprint
    const sprintDirs = fs.readdirSync(tasksDir)
      .filter(d => d.startsWith('sprint-'))
      .sort();
    if (sprintDirs.length === 0) process.exit(0);

    const currentSprint = sprintDirs[sprintDirs.length - 1];
    const sprintPath = path.join(tasksDir, currentSprint);

    // Count pending tasks
    let pending = 0;
    let total = 0;
    const files = fs.readdirSync(sprintPath).filter(f => f.endsWith('.md') && f !== '_README.md');
    for (const f of files) {
      try {
        const content = fs.readFileSync(path.join(sprintPath, f), 'utf8');
        if (content.includes('status:')) {
          total++;
          if (content.includes('status: todo')) pending++;
        }
      } catch (e) {}
    }

    if (pending > 0) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "Stop",
          additionalContext: `SPRINT WARNING: ${pending}/${total} tasks still pending in ${currentSprint}. ` +
            `Before stopping, confirm with the user that they want to pause the sprint.`
        }
      }));
    }
  } catch (e) {
    process.exit(0);
  }
});
