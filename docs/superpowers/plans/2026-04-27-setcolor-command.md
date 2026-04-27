# `agentlights setcolor` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive `npx agentlights setcolor` command that lets users browse a curated palette of background colors with arrow-key navigation, see live preview applied to the terminal pane, optionally enter a custom hex, and persist their choice so the existing hook script picks it up on the next `Stop` event.

**Architecture:** Two pure-data modules (`lib/colors.js`, `lib/config.js`) handle palette + persistence. A new command module `lib/commands/setcolor.js` drives the TTY interaction using only Node built-ins (`readline`, `process.stdin` raw mode). A small change to `scripts/colorize.sh` makes the hook script source the saved config. `test.js` and `doctor.js` are updated to consult the same saved color so all three commands stay consistent.

**Tech Stack:** Node 18+ (ESM, no transpile), POSIX shell, `node:test`. No new runtime dependencies.

---

## File Structure

```
agentlights/
├── bin/
│   └── cli.js                  # MODIFY: register setcolor, update usage
├── lib/
│   ├── paths.js                # MODIFY: export CONFIG_PATH
│   ├── colors.js               # CREATE: PRESETS, isValidHex, normalizeHex
│   ├── config.js               # CREATE: readSavedColor, writeSavedColor
│   └── commands/
│       ├── setcolor.js         # CREATE: interactive picker
│       ├── test.js             # MODIFY: consult readSavedColor
│       └── doctor.js           # MODIFY: consult readSavedColor + report source
├── scripts/
│   └── colorize.sh             # MODIFY: source ~/.claude/agentlights/config.sh
└── test/
    ├── colors.test.js          # CREATE
    └── config.test.js          # CREATE
```

---

## Task 1: Color palette module (`lib/colors.js`)

**Files:**
- Create: `lib/colors.js`
- Create: `test/colors.test.js`

- [ ] **Step 1: Write the failing tests**

Create `test/colors.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/colors.test.js`
Expected: FAIL with module-not-found / import errors.

- [ ] **Step 3: Implement `lib/colors.js`**

Create `lib/colors.js`:

```js
export const PRESETS = [
  { name: 'Indigo',     hex: '#2a2733' },
  { name: 'Slate',      hex: '#2a2d33' },
  { name: 'Navy',       hex: '#232838' },
  { name: 'Teal',       hex: '#1f2e2e' },
  { name: 'Forest',     hex: '#232b25' },
  { name: 'Plum',       hex: '#2e2433' },
  { name: 'Charcoal',   hex: '#262626' },
  { name: 'Slate Blue', hex: '#252a35' },
  { name: 'Sage',       hex: '#2a2e28' },
  { name: 'Deep Rose',  hex: '#332428' },
];

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isValidHex(s) {
  return typeof s === 'string' && HEX_RE.test(s);
}

export function normalizeHex(s) {
  if (!isValidHex(s)) {
    throw new Error(`Not a valid hex color: ${s}`);
  }
  const lower = s.toLowerCase();
  if (lower.length === 7) return lower;
  // #rgb -> #rrggbb
  return '#' + lower.slice(1).split('').map((c) => c + c).join('');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/colors.test.js`
Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/colors.js test/colors.test.js
git commit -m "feat: add color palette and hex helpers for setcolor"
```

---

## Task 2: Config persistence module (`lib/config.js`)

**Files:**
- Modify: `lib/paths.js` (add `CONFIG_PATH` export)
- Create: `lib/config.js`
- Create: `test/config.test.js`

- [ ] **Step 1: Add `CONFIG_PATH` to `lib/paths.js`**

Edit `lib/paths.js` — append after the existing `SCRIPT_PATH` line so the file becomes:

```js
import os from 'node:os';
import path from 'node:path';

export const HOME = os.homedir();
export const CLAUDE_DIR = path.join(HOME, '.claude');
export const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');
export const AGENTLIGHTS_DIR = path.join(CLAUDE_DIR, 'agentlights');
export const SCRIPT_PATH = path.join(AGENTLIGHTS_DIR, 'colorize.sh');
export const CONFIG_PATH = path.join(AGENTLIGHTS_DIR, 'config.sh');
```

- [ ] **Step 2: Write the failing tests**

Create `test/config.test.js`:

```js
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test test/config.test.js`
Expected: FAIL with module-not-found / import errors.

- [ ] **Step 4: Implement `lib/config.js`**

Create `lib/config.js`:

```js
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/config.test.js`
Expected: all 9 tests pass.

- [ ] **Step 6: Run the whole test suite to make sure nothing else broke**

Run: `npm test`
Expected: all tests pass (existing settings tests + new colors + config tests).

- [ ] **Step 7: Commit**

```bash
git add lib/paths.js lib/config.js test/config.test.js
git commit -m "feat: add config.sh persistence for waiting color"
```

---

## Task 3: Update hook script to source `config.sh`

**Files:**
- Modify: `scripts/colorize.sh`

- [ ] **Step 1: Rewrite `scripts/colorize.sh`**

Replace the entire contents of `scripts/colorize.sh` with:

```sh
#!/usr/bin/env sh
# agentlights — emits OSC 11 / OSC 111 to the controlling terminal
# Called by Claude Code hooks. Argument is "waiting" or "reset".

config="$HOME/.claude/agentlights/config.sh"
[ -f "$config" ] && . "$config"

color="${AGENTLIGHTS_WAITING_COLOR:-${AGENTLIGHTS_WAITING_COLOR_DEFAULT:-#2a2733}}"

case "$1" in
  waiting)
    printf '\033]11;%s\033\\' "$color" > /dev/tty 2>/dev/null
    ;;
  reset)
    printf '\033]111\033\\' > /dev/tty 2>/dev/null
    ;;
esac

exit 0
```

- [ ] **Step 2: Verify the script still parses and behaves correctly**

Run: `sh -n scripts/colorize.sh && echo OK`
Expected: prints `OK` (no syntax errors).

Run: `sh scripts/colorize.sh waiting < /dev/null > /dev/null 2>&1; echo "exit=$?"`
Expected: prints `exit=0`.

Run with a config file present:
```bash
mkdir -p /tmp/agentlights-test-home/.claude/agentlights
printf 'AGENTLIGHTS_WAITING_COLOR_DEFAULT="#abcdef"\n' \
  > /tmp/agentlights-test-home/.claude/agentlights/config.sh
HOME=/tmp/agentlights-test-home sh scripts/colorize.sh waiting < /dev/null > /dev/null 2>&1
echo "exit=$?"
rm -rf /tmp/agentlights-test-home
```
Expected: prints `exit=0`.

- [ ] **Step 3: Commit**

```bash
git add scripts/colorize.sh
git commit -m "feat: source ~/.claude/agentlights/config.sh from hook script"
```

---

## Task 4: Interactive `setcolor` command (`lib/commands/setcolor.js`)

**Files:**
- Create: `lib/commands/setcolor.js`

This task is not test-driven (TTY-driven interactive flow). Verification is manual at the end of this task.

- [ ] **Step 1: Create `lib/commands/setcolor.js`**

```js
import readline from 'node:readline';
import fs from 'node:fs/promises';
import { PRESETS, isValidHex, normalizeHex } from '../colors.js';
import { readSavedColor, writeSavedColor } from '../config.js';
import { SCRIPT_PATH } from '../paths.js';

const ESC = '\x1b';
const OSC11 = (hex) => `${ESC}]11;${hex}${ESC}\\`;
const OSC111 = `${ESC}]111${ESC}\\`;
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;
const CLEAR_LINE = `${ESC}[2K`;
const CURSOR_UP = (n) => `${ESC}[${n}A`;

const MENU_ITEMS = [
  ...PRESETS.map((p) => ({ kind: 'preset', name: p.name, hex: p.hex })),
  { kind: 'custom', name: 'Custom...' },
];

function paddedName(name) {
  return name.padEnd(12, ' ');
}

function renderMenu(stream, selectedIndex, savedHex) {
  let out = '';
  for (let i = 0; i < MENU_ITEMS.length; i++) {
    const item = MENU_ITEMS[i];
    const cursor = i === selectedIndex ? '>' : ' ';
    if (item.kind === 'preset') {
      const isCurrent = savedHex && item.hex.toLowerCase() === savedHex.toLowerCase();
      const suffix = isCurrent ? '  ← current' : '';
      out += `${CLEAR_LINE}${cursor} ${paddedName(item.name)}${item.hex}${suffix}\n`;
    } else {
      out += `${CLEAR_LINE}${cursor} ${item.name}\n`;
    }
  }
  stream.write(out);
}

function moveCursorAboveMenu(stream) {
  stream.write(CURSOR_UP(MENU_ITEMS.length));
}

function findInitialIndex(savedHex) {
  if (!savedHex) return 0;
  const idx = PRESETS.findIndex(
    (p) => p.hex.toLowerCase() === savedHex.toLowerCase()
  );
  if (idx >= 0) return idx;
  // saved hex is custom — highlight the Custom... row
  return MENU_ITEMS.length - 1;
}

async function promptCustomHex(savedHex) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    while (true) {
      const answer = await new Promise((resolve) => {
        rl.question('Hex color (e.g. #2a2d33, blank to cancel): ', resolve);
      });
      const trimmed = answer.trim();
      if (trimmed === '') return null;
      if (!isValidHex(trimmed)) {
        process.stdout.write(`  Not a valid hex color. Try #rgb or #rrggbb.\n`);
        continue;
      }
      return normalizeHex(trimmed);
    }
  } finally {
    rl.close();
  }
}

async function maybeWarnAboutStaleScript() {
  try {
    const installed = await fs.readFile(SCRIPT_PATH, 'utf8');
    if (!installed.includes('config.sh')) {
      console.log(
        `Note: your installed colorize.sh predates this version and will ignore the saved color.\n` +
        `      Run 'npx agentlights init' to update it.`
      );
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    // Script not installed at all — silent. setcolor still saves successfully.
  }
}

function maybeWarnAboutEnvOverride() {
  if (process.env.AGENTLIGHTS_WAITING_COLOR) {
    console.log(
      `Note: AGENTLIGHTS_WAITING_COLOR is set in your environment ` +
      `(${process.env.AGENTLIGHTS_WAITING_COLOR}) and will override this saved value.`
    );
  }
}

export async function setcolor() {
  if (!process.stdin.isTTY) {
    console.error('setcolor requires an interactive terminal');
    process.exit(1);
  }

  const savedHex = await readSavedColor();
  let selectedIndex = findInitialIndex(savedHex);

  const stdin = process.stdin;
  const stdout = process.stdout;
  let rawWasOn = false;
  let cursorWasHidden = false;
  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (rawWasOn) stdin.setRawMode(false);
    if (cursorWasHidden) stdout.write(SHOW_CURSOR);
    stdout.write(OSC111);
    stdin.pause();
  };

  const onSigint = () => {
    cleanup();
    console.log('\nCancelled.');
    process.exit(130);
  };
  process.on('SIGINT', onSigint);

  try {
    console.log('Use ↑/↓ to preview, Enter to save, Esc to cancel.\n');
    stdout.write(HIDE_CURSOR);
    cursorWasHidden = true;

    renderMenu(stdout, selectedIndex, savedHex);

    // Apply initial preview if highlight is on a preset.
    {
      const item = MENU_ITEMS[selectedIndex];
      if (item.kind === 'preset') stdout.write(OSC11(item.hex));
    }

    readline.emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    rawWasOn = true;
    stdin.resume();

    const result = await new Promise((resolve, reject) => {
      const onKey = (_str, key) => {
        if (!key) return;
        if (key.ctrl && key.name === 'c') {
          stdin.removeListener('keypress', onKey);
          resolve({ action: 'sigint' });
          return;
        }
        if (key.name === 'escape' || key.name === 'q') {
          stdin.removeListener('keypress', onKey);
          resolve({ action: 'cancel' });
          return;
        }
        if (key.name === 'up' || key.name === 'down') {
          const delta = key.name === 'up' ? -1 : 1;
          selectedIndex =
            (selectedIndex + delta + MENU_ITEMS.length) % MENU_ITEMS.length;
          moveCursorAboveMenu(stdout);
          renderMenu(stdout, selectedIndex, savedHex);
          const item = MENU_ITEMS[selectedIndex];
          if (item.kind === 'preset') {
            stdout.write(OSC11(item.hex));
          } else {
            stdout.write(OSC111);
          }
          return;
        }
        if (key.name === 'return') {
          stdin.removeListener('keypress', onKey);
          resolve({ action: 'select', item: MENU_ITEMS[selectedIndex] });
          return;
        }
      };
      stdin.on('keypress', onKey);
      stdin.once('error', reject);
    });

    if (result.action === 'sigint') {
      onSigint();
      return; // unreachable
    }
    if (result.action === 'cancel') {
      cleanup();
      console.log('Cancelled.');
      return;
    }
    // result.action === 'select'
    if (result.item.kind === 'preset') {
      cleanup();
      await writeSavedColor(result.item.hex);
      console.log(
        `Saved ${result.item.hex} (${result.item.name}). ` +
        `Next time Claude finishes a turn, your pane will tint to this color.`
      );
      await maybeWarnAboutStaleScript();
      maybeWarnAboutEnvOverride();
      return;
    }
    // Custom selected: tear down raw mode, prompt, then save.
    if (rawWasOn) {
      stdin.setRawMode(false);
      rawWasOn = false;
    }
    if (cursorWasHidden) {
      stdout.write(SHOW_CURSOR);
      cursorWasHidden = false;
    }
    stdout.write(OSC111);
    const customHex = await promptCustomHex(savedHex);
    if (customHex === null) {
      cleanup();
      console.log('Cancelled.');
      return;
    }
    await writeSavedColor(customHex);
    console.log(
      `Saved ${customHex}. ` +
      `Next time Claude finishes a turn, your pane will tint to this color.`
    );
    await maybeWarnAboutStaleScript();
    maybeWarnAboutEnvOverride();
  } finally {
    process.removeListener('SIGINT', onSigint);
    cleanup();
  }
}
```

- [ ] **Step 2: Quick syntax / import check**

Run: `node --check lib/commands/setcolor.js && echo OK`
Expected: prints `OK`.

Run: `node -e "import('./lib/commands/setcolor.js').then((m) => console.log(typeof m.setcolor))"`
Expected: prints `function`.

- [ ] **Step 3: Commit**

```bash
git add lib/commands/setcolor.js
git commit -m "feat: add interactive setcolor command"
```

---

## Task 5: Wire `setcolor` into the CLI

**Files:**
- Modify: `bin/cli.js`

- [ ] **Step 1: Replace `bin/cli.js` contents**

Rewrite `bin/cli.js` so it becomes:

```js
#!/usr/bin/env node
import { init } from '../lib/commands/init.js';
import { uninstall } from '../lib/commands/uninstall.js';
import { doctor } from '../lib/commands/doctor.js';
import { test } from '../lib/commands/test.js';
import { setcolor } from '../lib/commands/setcolor.js';

const commands = { init, uninstall, doctor, test, setcolor };

const cmd = process.argv[2];

if (!cmd || !commands[cmd]) {
  console.log(`Usage: agentlights <command>

Commands:
  init       Wire up Claude Code hooks
  uninstall  Remove hooks and script
  doctor     Verify installation
  test       Preview the waiting color in this terminal
  setcolor   Interactively pick the waiting color`);
  process.exit(cmd ? 1 : 0);
}

try {
  await commands[cmd]();
} catch (err) {
  console.error(`agentlights: ${err.message}`);
  process.exit(1);
}
```

- [ ] **Step 2: Verify the CLI lists the new command**

Run: `node bin/cli.js`
Expected: prints usage including `setcolor   Interactively pick the waiting color`. Exit code 0.

Run: `node bin/cli.js bogus`
Expected: prints same usage, exit code 1.

- [ ] **Step 3: Commit**

```bash
git add bin/cli.js
git commit -m "feat: register setcolor in CLI dispatch"
```

---

## Task 6: Make `test` and `doctor` consult the saved color

**Files:**
- Modify: `lib/commands/test.js`
- Modify: `lib/commands/doctor.js`

- [ ] **Step 1: Update `lib/commands/test.js`**

Replace the entire file with:

```js
import { readSavedColor } from '../config.js';

export async function test() {
  const color =
    process.env.AGENTLIGHTS_WAITING_COLOR ??
    (await readSavedColor()) ??
    '#2a2733';
  console.log(`Setting background to ${color} for 3 seconds...`);
  process.stdout.write(`\x1b]11;${color}\x1b\\`);
  await new Promise((r) => setTimeout(r, 3000));
  process.stdout.write(`\x1b]111\x1b\\`);
  console.log(`Reset to default. If you saw the color change, you're good.`);
}
```

- [ ] **Step 2: Update `lib/commands/doctor.js`**

Replace the final color-reporting section. The full file becomes:

```js
import fs from 'node:fs/promises';
import { SETTINGS_PATH, SCRIPT_PATH } from '../paths.js';
import { readSettings, isOurEntry } from '../settings.js';
import { readSavedColor } from '../config.js';

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

  const envColor = process.env.AGENTLIGHTS_WAITING_COLOR;
  const savedColor = await readSavedColor();
  let color, source;
  if (envColor) {
    color = envColor;
    source = 'env (AGENTLIGHTS_WAITING_COLOR)';
  } else if (savedColor) {
    color = savedColor;
    source = 'saved (run `agentlights setcolor` to change)';
  } else {
    color = '#2a2733';
    source = 'built-in default';
  }
  console.log(`  Configured waiting color: ${color}  [${source}]`);

  if (!allOk) {
    console.log(`\nRun 'npx agentlights init' to repair.`);
    process.exit(1);
  }
}
```

- [ ] **Step 3: Run the whole test suite to confirm nothing regressed**

Run: `npm test`
Expected: all tests pass (existing + colors + config).

- [ ] **Step 4: Verify `doctor` reports the new color source line**

Run: `node bin/cli.js doctor`
Expected: includes a line like `  Configured waiting color: #2a2733  [built-in default]` (or `[env ...]` / `[saved ...]` depending on environment). The command may exit 1 if hooks aren't installed in this dev environment — that's fine; the color-reporting line should still print.

- [ ] **Step 5: Commit**

```bash
git add lib/commands/test.js lib/commands/doctor.js
git commit -m "feat: have test and doctor commands consult saved color"
```

---

## Task 7: Manual end-to-end verification

**Files:** none (verification only).

This is a smoke test in a real terminal. Skip individual steps if the environment can't run them, but note which were skipped.

- [ ] **Step 1: Run the test suite one final time**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Sanity-check the CLI surface**

Run: `node bin/cli.js`
Expected: usage block includes `setcolor`.

- [ ] **Step 3: Try `setcolor` interactively (requires a real terminal)**

In an interactive terminal pane, run: `node bin/cli.js setcolor`

Verify each of:
- The menu prints with `>` on the first row (or on the row matching the saved color, if there is one).
- Pressing ↓ moves the highlight down and the pane background changes.
- Pressing ↑ moves it back; the pane background follows.
- Wrapping works at the top and bottom of the list.
- Pressing Enter on a preset row prints `Saved <hex> ...` and the menu disappears (terminal returns to default).
- After saving, `node bin/cli.js doctor` reports the new color with `[saved ...]`.
- Re-running `setcolor` highlights the saved color with `← current` next to it.
- Selecting `Custom...` and entering `#3a2a40` saves and reports correctly.
- Selecting `Custom...` and pressing Enter on an empty prompt prints `Cancelled.` and exits 0 without changing the saved value.
- Pressing `q` or Esc at the menu prints `Cancelled.` and the pane returns to default.
- Pressing Ctrl+C at the menu prints `Cancelled.` and the pane returns to default.

- [ ] **Step 4: Confirm the hook script picks up the saved color**

After saving a color via `setcolor`, run: `~/.claude/agentlights/colorize.sh waiting`
Expected: the pane background tints to the saved color (you may need to re-run `npx agentlights init` first if your installed `colorize.sh` is from before Task 3).

Then run: `~/.claude/agentlights/colorize.sh reset`
Expected: pane returns to default.

- [ ] **Step 5: Confirm non-TTY rejection**

Run: `node bin/cli.js setcolor < /dev/null`
Expected: prints `setcolor requires an interactive terminal`, exit code 1.

- [ ] **Step 6: Note any verification steps that were skipped**

If any of Step 3 / Step 4 couldn't be executed (e.g., headless environment), note it in the final report so the user knows what still needs human verification. Do not claim the feature is complete without explicitly saying which interactive steps were not run.

- [ ] **Step 7: Final commit (if any cleanup was needed)**

If Steps 1-6 surfaced no issues, no commit is needed for this task. If they did, fix and commit:

```bash
git add <touched-files>
git commit -m "fix: <description of the fix>"
```

---

## Self-Review Checklist (run after writing the plan)

- **Spec coverage:**
  - UX: arrow nav + live preview → Task 4. ✓
  - Custom hex prompt + validation → Task 4. ✓
  - Esc/q/Ctrl+C cancel paths → Task 4. ✓
  - Non-TTY error → Task 4 + verified in Task 7. ✓
  - 10-color palette (option A) → Task 1. ✓
  - Persistence to `~/.claude/agentlights/config.sh` → Task 2. ✓
  - Updated `colorize.sh` sourcing config → Task 3. ✓
  - Env var still overrides → Task 3 (shell precedence) + Task 6 (test/doctor precedence). ✓
  - `← current` annotation → Task 4. ✓
  - Initial highlight = saved-or-Custom → Task 4 (`findInitialIndex`). ✓
  - Stale-script warning → Task 4 (`maybeWarnAboutStaleScript`). ✓
  - Env-var-set warning → Task 4 (`maybeWarnAboutEnvOverride`). ✓
  - `test` + `doctor` consult saved color → Task 6. ✓
  - Tests for `colors.js` and `config.js` → Tasks 1 and 2. ✓
  - Cleanup on crash / SIGINT → Task 4 (`try/finally` + SIGINT handler). ✓
- **Placeholder scan:** None present.
- **Type consistency:** `readSavedColor` returns `string | null`; consumers (`setcolor`, `test`, `doctor`) all handle the null case. `writeSavedColor` accepts a hex; preset hexes and `normalizeHex` output both satisfy `isValidHex`. Menu item shape `{ kind, name, hex? }` is consistent across `MENU_ITEMS`, `renderMenu`, `findInitialIndex`, and the keypress handler.
