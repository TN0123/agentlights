import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readSavedColor, writeSavedColor } from '../lib/config.js';

async function tmpConfigPath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentlights-cfg-'));
  return path.join(dir, 'nested', 'config.sh');
}

test('readSavedColor returns null when file does not exist', async () => {
  const p = await tmpConfigPath();
  assert.equal(await readSavedColor(p), null);
});

test('writeSavedColor then readSavedColor round-trips', async () => {
  const p = await tmpConfigPath();
  await writeSavedColor(p, '#2a2d33');
  assert.equal(await readSavedColor(p), '#2a2d33');
});

test('writeSavedColor creates parent directory if missing', async () => {
  const p = await tmpConfigPath();
  await writeSavedColor(p, '#abcdef');
  const stat = await fs.stat(p);
  assert.ok(stat.isFile());
});

test('writeSavedColor writes a sourceable assignment with double quotes', async () => {
  const p = await tmpConfigPath();
  await writeSavedColor(p, '#112233');
  const raw = await fs.readFile(p, 'utf8');
  assert.match(raw, /AGENTLIGHTS_WAITING_COLOR_DEFAULT="#112233"/);
});

test('readSavedColor returns null when assignment line is absent', async () => {
  const p = await tmpConfigPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, '# unrelated comment\nFOO="bar"\n');
  assert.equal(await readSavedColor(p), null);
});

test('readSavedColor ignores surrounding lines and parses assignment', async () => {
  const p = await tmpConfigPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(
    p,
    '# header comment\nFOO="bar"\nAGENTLIGHTS_WAITING_COLOR_DEFAULT="#abcdef"\n# trailing\n'
  );
  assert.equal(await readSavedColor(p), '#abcdef');
});

test('readSavedColor returns null on invalid hex value', async () => {
  const p = await tmpConfigPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, 'AGENTLIGHTS_WAITING_COLOR_DEFAULT="not-a-color"\n');
  assert.equal(await readSavedColor(p), null);
});

test('writeSavedColor rejects invalid hex', async () => {
  const p = await tmpConfigPath();
  await assert.rejects(writeSavedColor(p, 'nope'), /valid hex/);
});

test('writeSavedColor normalizes #rgb shorthand on save', async () => {
  const p = await tmpConfigPath();
  await writeSavedColor(p, '#aBc');
  assert.equal(await readSavedColor(p), '#aabbcc');
});
