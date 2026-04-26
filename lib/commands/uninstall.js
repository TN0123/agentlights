import fs from 'node:fs/promises';
import { SETTINGS_PATH, AGENTLIGHTS_DIR, SCRIPT_PATH } from '../paths.js';
import { readSettings, writeSettings, uninstallHooks } from '../settings.js';

export async function uninstall() {
  const settings = await readSettings(SETTINGS_PATH);
  const next = uninstallHooks(settings, SCRIPT_PATH);
  await writeSettings(SETTINGS_PATH, next);
  console.log(`✓ Removed agentlights hooks from ${SETTINGS_PATH}`);

  await fs.rm(AGENTLIGHTS_DIR, { recursive: true, force: true });
  console.log(`✓ Removed ${AGENTLIGHTS_DIR}`);
}
