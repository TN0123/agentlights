import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SETTINGS_PATH, AGENTLIGHTS_DIR, SCRIPT_PATH } from '../paths.js';
import { readSettings, writeSettings, installHooks } from '../settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_SCRIPT = path.resolve(__dirname, '../../scripts/colorize.sh');

export async function init() {
  const settings = await readSettings(SETTINGS_PATH);
  const next = installHooks(settings, SCRIPT_PATH);

  await fs.mkdir(AGENTLIGHTS_DIR, { recursive: true });
  const scriptContents = await fs.readFile(PACKAGE_SCRIPT, 'utf8');
  await fs.writeFile(SCRIPT_PATH, scriptContents, { mode: 0o755 });
  await writeSettings(SETTINGS_PATH, next);

  console.log(`✓ Installed colorize.sh to ${SCRIPT_PATH}`);
  console.log(`✓ Wired hooks into ${SETTINGS_PATH}`);
  console.log(`Run 'npx agentlights test' to preview the color.`);
}
