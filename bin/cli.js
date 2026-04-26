#!/usr/bin/env node
import { init } from '../lib/commands/init.js';

const commands = { init };

const cmd = process.argv[2];

if (!cmd || !commands[cmd]) {
  console.log(`Usage: agentlights <command>

Commands:
  init       Wire up Claude Code hooks
  uninstall  Remove hooks and script
  doctor     Verify installation
  test       Preview the waiting color in this terminal`);
  process.exit(cmd ? 1 : 0);
}

try {
  await commands[cmd]();
} catch (err) {
  console.error(`agentlights: ${err.message}`);
  process.exit(1);
}
