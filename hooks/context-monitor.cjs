#!/usr/bin/env node
// Context Monitor — PostToolUse hook
// Reads context_window from the hook payload and injects warnings
// when context usage is high. Self-contained — no bridge file needed.
//
// Thresholds:
//   WARNING  (remaining <= 35%): Agent should wrap up current task
//   CRITICAL (remaining <= 25%): Agent should stop immediately

const fs = require('fs');
const os = require('os');
const path = require('path');

const WARNING_THRESHOLD = 35;
const CRITICAL_THRESHOLD = 25;
const DEBOUNCE_CALLS = 5;
const AUTO_COMPACT_BUFFER_PCT = 16.5;

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 10000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const sessionId = data.session_id;
    const remaining = data.context_window?.remaining_percentage;

    // No session or no context data — exit silently
    if (!sessionId || remaining == null) {
      process.exit(0);
    }

    // Sanitize session ID
    if (/[/\\]|\.\./.test(sessionId)) {
      process.exit(0);
    }

    // Normalize to usable context (subtract autocompact buffer)
    const usableRemaining = Math.max(0, ((remaining - AUTO_COMPACT_BUFFER_PCT) / (100 - AUTO_COMPACT_BUFFER_PCT)) * 100);
    const usedPct = Math.round(100 - usableRemaining);

    // No warning needed
    if (usableRemaining > WARNING_THRESHOLD) {
      process.exit(0);
    }

    // Debounce
    const tmpDir = os.tmpdir();
    const warnPath = path.join(tmpDir, `brigade-ctx-${sessionId}-warned.json`);
    let warnData = { callsSinceWarn: 0, lastLevel: null };
    let firstWarn = true;

    if (fs.existsSync(warnPath)) {
      try {
        warnData = JSON.parse(fs.readFileSync(warnPath, 'utf8'));
        firstWarn = false;
      } catch (e) {}
    }

    warnData.callsSinceWarn = (warnData.callsSinceWarn || 0) + 1;

    const isCritical = usableRemaining <= CRITICAL_THRESHOLD;
    const currentLevel = isCritical ? 'critical' : 'warning';
    const severityEscalated = currentLevel === 'critical' && warnData.lastLevel === 'warning';

    if (!firstWarn && warnData.callsSinceWarn < DEBOUNCE_CALLS && !severityEscalated) {
      fs.writeFileSync(warnPath, JSON.stringify(warnData));
      process.exit(0);
    }

    warnData.callsSinceWarn = 0;
    warnData.lastLevel = currentLevel;
    fs.writeFileSync(warnPath, JSON.stringify(warnData));

    let message;
    if (isCritical) {
      message = `CONTEXT CRITICAL: ${usedPct}% used. ` +
        'Context is nearly exhausted. Inform the user and ask how to proceed.';
    } else {
      message = `CONTEXT WARNING: ${usedPct}% used. ` +
        'Context is getting limited. Avoid starting new complex work.';
    }

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: message
      }
    }));
  } catch (e) {
    process.exit(0);
  }
});
