import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, isValidHex, normalizeHex } from '../lib/colors.js';

test('PRESETS has exactly 10 entries', () => {
  assert.equal(PRESETS.length, 10);
});

test('PRESETS entries are { name, hex } with valid hex and unique names', () => {
  const names = new Set();
  const hexes = new Set();
  for (const { name, hex } of PRESETS) {
    assert.equal(typeof name, 'string');
    assert.ok(name.length > 0, 'name is non-empty');
    assert.ok(isValidHex(hex), `${hex} is valid hex`);
    assert.ok(!names.has(name), `name ${name} is unique`);
    assert.ok(!hexes.has(hex.toLowerCase()), `hex ${hex} is unique`);
    names.add(name);
    hexes.add(hex.toLowerCase());
  }
});

test('isValidHex accepts #rrggbb (lower, upper, mixed)', () => {
  assert.ok(isValidHex('#aabbcc'));
  assert.ok(isValidHex('#AABBCC'));
  assert.ok(isValidHex('#aAbBcC'));
});

test('isValidHex accepts #rgb shorthand', () => {
  assert.ok(isValidHex('#abc'));
  assert.ok(isValidHex('#ABC'));
});

test('isValidHex rejects junk', () => {
  assert.equal(isValidHex(''), false);
  assert.equal(isValidHex('abc'), false);          // missing #
  assert.equal(isValidHex('#ab'), false);          // wrong length
  assert.equal(isValidHex('#abcd'), false);        // wrong length
  assert.equal(isValidHex('#abcde'), false);       // wrong length
  assert.equal(isValidHex('#gggggg'), false);      // non-hex chars
  assert.equal(isValidHex('#12345g'), false);
  assert.equal(isValidHex(null), false);
  assert.equal(isValidHex(undefined), false);
  assert.equal(isValidHex(123), false);
});

test('normalizeHex lowercases #rrggbb', () => {
  assert.equal(normalizeHex('#AaBbCc'), '#aabbcc');
});

test('normalizeHex expands #rgb to #rrggbb and lowercases', () => {
  assert.equal(normalizeHex('#aBc'), '#aabbcc');
  assert.equal(normalizeHex('#ABC'), '#aabbcc');
});
