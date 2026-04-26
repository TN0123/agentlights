import fs from 'node:fs/promises';
import path from 'node:path';

export async function readSettings(settingsPath) {
  let raw;
  try {
    raw = await fs.readFile(settingsPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
  if (raw.trim() === '') return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Could not parse ${settingsPath} as JSON: ${err.message}`);
  }
}

export async function writeSettings(settingsPath, settings) {
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}
