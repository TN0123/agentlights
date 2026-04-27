import fs from 'node:fs/promises';
import path from 'node:path';
import { CONFIG_PATH } from './paths.js';
import { isValidHex, normalizeHex } from './colors.js';

const ASSIGNMENT_RE = /^\s*AGENTLIGHTS_WAITING_COLOR_DEFAULT="([^"]*)"\s*$/m;

const FILE_HEADER =
  '# Written by `agentlights setcolor`. Edit via the CLI.\n';

export { CONFIG_PATH };

export async function readSavedColor(configPath = CONFIG_PATH) {
  let raw;
  try {
    raw = await fs.readFile(configPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  const m = raw.match(ASSIGNMENT_RE);
  if (!m) return null;
  const value = m[1];
  if (!isValidHex(value)) return null;
  return normalizeHex(value);
}

export async function writeSavedColor(configPath, hex) {
  // Allow being called with a single arg (uses default path).
  if (hex === undefined) {
    hex = configPath;
    configPath = CONFIG_PATH;
  }
  if (!isValidHex(hex)) {
    throw new Error(`writeSavedColor: not a valid hex color: ${hex}`);
  }
  const normalized = normalizeHex(hex);
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  const body = `${FILE_HEADER}AGENTLIGHTS_WAITING_COLOR_DEFAULT="${normalized}"\n`;
  await fs.writeFile(configPath, body, 'utf8');
}
