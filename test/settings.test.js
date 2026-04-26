import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readSettings, writeSettings } from '../lib/settings.js';
import { installHooks, uninstallHooks } from '../lib/settings.js';

async function tmpFile() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentlights-'));
  return path.join(dir, 'settings.json');
}

test('readSettings returns {} when file does not exist', async () => {
  const p = await tmpFile();
  const result = await readSettings(p);
  assert.deepEqual(result, {});
});

test('readSettings returns {} for empty file', async () => {
  const p = await tmpFile();
  await fs.writeFile(p, '');
  const result = await readSettings(p);
  assert.deepEqual(result, {});
});

test('readSettings parses valid JSON', async () => {
  const p = await tmpFile();
  await fs.writeFile(p, JSON.stringify({ hooks: { Stop: [] } }));
  const result = await readSettings(p);
  assert.deepEqual(result, { hooks: { Stop: [] } });
});

test('readSettings throws on malformed JSON', async () => {
  const p = await tmpFile();
  await fs.writeFile(p, '{not valid json');
  await assert.rejects(readSettings(p), /Could not parse/);
});

test('writeSettings creates parent directory if missing', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentlights-'));
  const p = path.join(dir, 'nested', 'settings.json');
  await writeSettings(p, { foo: 'bar' });
  const written = JSON.parse(await fs.readFile(p, 'utf8'));
  assert.deepEqual(written, { foo: 'bar' });
});

test('writeSettings writes 2-space-indented JSON with trailing newline', async () => {
  const p = await tmpFile();
  await writeSettings(p, { a: 1 });
  const raw = await fs.readFile(p, 'utf8');
  assert.equal(raw, '{\n  "a": 1\n}\n');
});

const SCRIPT = '/home/u/.claude/agentlights/colorize.sh';

test('installHooks adds all three events to empty settings', () => {
  const result = installHooks({}, SCRIPT);
  assert.ok(result.hooks.Stop?.length === 1);
  assert.ok(result.hooks.UserPromptSubmit?.length === 1);
  assert.ok(result.hooks.SessionEnd?.length === 1);
  assert.equal(result.hooks.Stop[0].hooks[0].command, `${SCRIPT} waiting`);
  assert.equal(result.hooks.UserPromptSubmit[0].hooks[0].command, `${SCRIPT} reset`);
  assert.equal(result.hooks.SessionEnd[0].hooks[0].command, `${SCRIPT} reset`);
});

test('installHooks preserves existing unrelated hooks', () => {
  const existing = {
    hooks: {
      Stop: [
        { matcher: '', hooks: [{ type: 'command', command: '/usr/bin/notify "done"' }] }
      ],
      PreToolUse: [
        { matcher: 'Bash', hooks: [{ type: 'command', command: '/usr/bin/lint' }] }
      ]
    }
  };
  const result = installHooks(existing, SCRIPT);
  assert.equal(result.hooks.Stop.length, 2, 'Stop should have user + ours');
  assert.equal(result.hooks.Stop[0].hooks[0].command, '/usr/bin/notify "done"');
  assert.equal(result.hooks.PreToolUse.length, 1, 'unrelated event untouched');
});

test('installHooks is idempotent (running twice is a no-op)', () => {
  const once = installHooks({}, SCRIPT);
  const twice = installHooks(once, SCRIPT);
  assert.deepEqual(twice, once);
});

test('installHooks does not mutate input settings', () => {
  const original = { hooks: { Stop: [] } };
  const snapshot = JSON.parse(JSON.stringify(original));
  installHooks(original, SCRIPT);
  assert.deepEqual(original, snapshot);
});

test('installHooks handles missing hooks key', () => {
  const result = installHooks({ otherSetting: 'foo' }, SCRIPT);
  assert.equal(result.otherSetting, 'foo');
  assert.ok(result.hooks);
});

test('uninstallHooks removes our entries', () => {
  const installed = installHooks({}, SCRIPT);
  const result = uninstallHooks(installed, SCRIPT);
  assert.deepEqual(result, {});
});

test('uninstallHooks preserves unrelated entries', () => {
  const settings = {
    hooks: {
      Stop: [
        { matcher: '', hooks: [{ type: 'command', command: '/usr/bin/notify' }] },
        { matcher: '', hooks: [{ type: 'command', command: `${SCRIPT} waiting` }] }
      ]
    }
  };
  const result = uninstallHooks(settings, SCRIPT);
  assert.equal(result.hooks.Stop.length, 1);
  assert.equal(result.hooks.Stop[0].hooks[0].command, '/usr/bin/notify');
});

test('uninstallHooks on settings without our entries is a no-op', () => {
  const settings = {
    hooks: {
      Stop: [
        { matcher: '', hooks: [{ type: 'command', command: '/usr/bin/notify' }] }
      ]
    }
  };
  const result = uninstallHooks(settings, SCRIPT);
  assert.deepEqual(result, settings);
});

test('uninstallHooks handles missing hooks key', () => {
  const result = uninstallHooks({ otherSetting: 'foo' }, SCRIPT);
  assert.deepEqual(result, { otherSetting: 'foo' });
});

test('uninstallHooks does not mutate input', () => {
  const installed = installHooks({}, SCRIPT);
  const snapshot = JSON.parse(JSON.stringify(installed));
  uninstallHooks(installed, SCRIPT);
  assert.deepEqual(installed, snapshot);
});
