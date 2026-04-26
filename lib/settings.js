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

const HOOK_EVENTS = ['Stop', 'UserPromptSubmit', 'SessionEnd'];
const STATE_BY_EVENT = {
  Stop: 'waiting',
  UserPromptSubmit: 'reset',
  SessionEnd: 'reset',
};

export function isOurEntry(entry, scriptPath) {
  if (!entry || !Array.isArray(entry.hooks)) return false;
  return entry.hooks.some(
    (h) =>
      h && h.type === 'command' &&
      typeof h.command === 'string' &&
      h.command.includes(scriptPath)
  );
}

export function installHooks(settings, scriptPath) {
  const next = structuredClone(settings ?? {});
  next.hooks = next.hooks ?? {};
  for (const event of HOOK_EVENTS) {
    next.hooks[event] = next.hooks[event] ?? [];
    const alreadyInstalled = next.hooks[event].some((e) =>
      isOurEntry(e, scriptPath)
    );
    if (alreadyInstalled) continue;
    next.hooks[event].push({
      matcher: '',
      hooks: [
        {
          type: 'command',
          command: `${scriptPath} ${STATE_BY_EVENT[event]}`,
        },
      ],
    });
  }
  return next;
}

export function uninstallHooks(settings, scriptPath) {
  const next = structuredClone(settings ?? {});
  if (!next.hooks) return next;
  for (const event of HOOK_EVENTS) {
    if (!Array.isArray(next.hooks[event])) continue;
    next.hooks[event] = next.hooks[event].filter(
      (e) => !isOurEntry(e, scriptPath)
    );
    if (next.hooks[event].length === 0) {
      delete next.hooks[event];
    }
  }
  if (Object.keys(next.hooks).length === 0) {
    delete next.hooks;
  }
  return next;
}
