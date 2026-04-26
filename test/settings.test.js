import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readSettings, writeSettings } from '../lib/settings.js';

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
