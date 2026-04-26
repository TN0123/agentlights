import fs from 'node:fs/promises';
import { SETTINGS_PATH, SCRIPT_PATH } from '../paths.js';
import { readSettings, isOurEntry } from '../settings.js';

const HOOK_EVENTS = ['Stop', 'UserPromptSubmit', 'SessionEnd'];

export async function doctor() {
  let allOk = true;

  try {
    const stat = await fs.stat(SCRIPT_PATH);
    if (!(stat.mode & 0o111)) {
      console.log(`✗ ${SCRIPT_PATH} exists but is not executable`);
      allOk = false;
    } else {
      console.log(`✓ Script present and executable: ${SCRIPT_PATH}`);
    }
  } catch {
    console.log(`✗ Script missing: ${SCRIPT_PATH}`);
    allOk = false;
  }

  const settings = await readSettings(SETTINGS_PATH);
  for (const event of HOOK_EVENTS) {
    const entries = settings.hooks?.[event] ?? [];
    const found = entries.some((e) => isOurEntry(e, SCRIPT_PATH));
    if (found) {
      console.log(`✓ Hook installed: ${event}`);
    } else {
      console.log(`✗ Hook missing: ${event}`);
      allOk = false;
    }
  }

  const color = process.env.AGENTLIGHTS_WAITING_COLOR ?? '#2a2733';
  console.log(`  Configured waiting color: ${color}`);

  if (!allOk) {
    console.log(`\nRun 'npx agentlights init' to repair.`);
    process.exit(1);
  }
}
