#!/usr/bin/env node
import { init } from '../lib/commands/init.js';
import { uninstall } from '../lib/commands/uninstall.js';
import { doctor } from '../lib/commands/doctor.js';
import { test } from '../lib/commands/test.js';

const commands = { init, uninstall, doctor, test };

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
