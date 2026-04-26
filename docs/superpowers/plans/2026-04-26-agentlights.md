# agentlights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish `agentlights` — an npm package that wires Claude Code hooks to change the terminal background color when Claude finishes a turn (and reset it when the user submits a prompt or the session ends).

**Architecture:** Tiny Node CLI distributed via `npx`. Three subcommands (`init`, `uninstall`, `doctor`, `test`) plus a single POSIX shell script (`colorize.sh`) that emits OSC 11 / OSC 111. The CLI's only non-trivial logic is merging entries into `~/.claude/settings.json` without clobbering existing user hooks. Tested via Node's built-in `node:test`.

**Tech Stack:** Node 18+ (ESM, no transpile), POSIX shell, npm, `node:test`.

---

## File Structure

```
agentlights/
├── package.json                # npm package, bin entry, engines, files
├── .gitignore                  # node_modules, .DS_Store, etc.
├── LICENSE                     # MIT
├── README.md                   # Install, usage, customization, troubleshooting
├── bin/
│   └── cli.js                  # CLI entry: argv parsing + command dispatch
├── lib/
│   ├── paths.js                # Path constants (~/.claude/settings.json, etc.)
│   ├── settings.js             # JSON read/write + install/uninstall merge logic
│   └── commands/
│       ├── init.js             # `agentlights init`
│       ├── uninstall.js        # `agentlights uninstall`
│       ├── doctor.js           # `agentlights doctor`
│       └── test.js             # `agentlights test` (visual preview)
├── scripts/
│   └── colorize.sh             # POSIX shell script run by Claude Code hooks
└── test/
    └── settings.test.js        # Unit tests for settings.js merge logic
```

---

### Task 1: Repo scaffold (package.json, .gitignore, LICENSE)

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `LICENSE`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "agentlights",
  "version": "0.1.0",
  "description": "Color your Claude Code terminal pane when Claude is waiting on you",
  "type": "module",
  "bin": {
    "agentlights": "./bin/cli.js"
  },
  "files": [
    "bin/",
    "lib/",
    "scripts/",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "test": "node --test test/"
  },
  "engines": {
    "node": ">=18"
  },
  "license": "MIT",
  "keywords": [
    "claude-code",
    "ghostty",
    "terminal",
    "hooks"
  ]
}
```

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
.DS_Store
*.log
.npm/
```

- [ ] **Step 3: Write `LICENSE` (MIT)**

```
MIT License

Copyright (c) 2026 Tanay Naik

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 4: Verify package.json parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json'))"`
Expected: no output, exit 0.

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore LICENSE
git commit -m "chore: scaffold npm package"
```

---

### Task 2: Write the colorize.sh script

**Files:**
- Create: `scripts/colorize.sh`

- [ ] **Step 1: Write `scripts/colorize.sh`**

```sh
#!/usr/bin/env sh
# agentlights — emits OSC 11 / OSC 111 to the controlling terminal
# Called by Claude Code hooks. Argument is "waiting" or "reset".

color="${AGENTLIGHTS_WAITING_COLOR:-#2a2733}"

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

- [ ] **Step 2: Make it executable**

Run: `chmod +x scripts/colorize.sh`

- [ ] **Step 3: Smoke-test it manually**

Run: `./scripts/colorize.sh waiting`
Expected: terminal background changes to subtle indigo (#2a2733).

Run: `./scripts/colorize.sh reset`
Expected: terminal background returns to theme default.

(If you don't see a change, your terminal may not support OSC 11. Test in Ghostty / iTerm2 / kitty / WezTerm.)

- [ ] **Step 4: Verify exit 0 on bad input**

Run: `./scripts/colorize.sh garbage; echo "exit=$?"`
Expected: `exit=0` (script swallows unknown args silently).

- [ ] **Step 5: Commit**

```bash
git add scripts/colorize.sh
git commit -m "feat: add colorize.sh shell script"
```

---

### Task 3: Path constants module

**Files:**
- Create: `lib/paths.js`

- [ ] **Step 1: Write `lib/paths.js`**

```js
import os from 'node:os';
import path from 'node:path';

export const HOME = os.homedir();
export const CLAUDE_DIR = path.join(HOME, '.claude');
export const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');
export const AGENTLIGHTS_DIR = path.join(CLAUDE_DIR, 'agentlights');
export const SCRIPT_PATH = path.join(AGENTLIGHTS_DIR, 'colorize.sh');
```

- [ ] **Step 2: Verify it loads**

Run: `node -e "import('./lib/paths.js').then(m => console.log(m.SETTINGS_PATH))"`
Expected: prints `/Users/<you>/.claude/settings.json` (or equivalent on your platform).

- [ ] **Step 3: Commit**

```bash
git add lib/paths.js
git commit -m "feat: add path constants module"
```

---

### Task 4: settings.js — readSettings & writeSettings (TDD)

**Files:**
- Create: `lib/settings.js`
- Create: `test/settings.test.js`

- [ ] **Step 1: Write the failing tests**

Write `test/settings.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: all 6 tests fail with "Cannot find module" or similar (settings.js doesn't exist yet).

- [ ] **Step 3: Implement `lib/settings.js` (read/write only for now)**

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/settings.js test/settings.test.js
git commit -m "feat: add settings read/write with malformed-JSON handling"
```

---

### Task 5: settings.js — installHooks (TDD)

**Files:**
- Modify: `lib/settings.js`
- Modify: `test/settings.test.js`

- [ ] **Step 1: Add failing tests**

Append to `test/settings.test.js`:

```js
import { installHooks } from '../lib/settings.js';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: 5 new tests fail with "installHooks is not a function" or similar.

- [ ] **Step 3: Implement `installHooks`**

Append to `lib/settings.js`:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all 11 tests (6 from Task 4 + 5 new) pass.

- [ ] **Step 5: Commit**

```bash
git add lib/settings.js test/settings.test.js
git commit -m "feat: add installHooks with idempotent JSON merge"
```

---

### Task 6: settings.js — uninstallHooks (TDD)

**Files:**
- Modify: `lib/settings.js`
- Modify: `test/settings.test.js`

- [ ] **Step 1: Add failing tests**

Append to `test/settings.test.js`:

```js
import { uninstallHooks } from '../lib/settings.js';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: 5 new tests fail with "uninstallHooks is not a function".

- [ ] **Step 3: Implement `uninstallHooks`**

Append to `lib/settings.js`:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all 16 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/settings.js test/settings.test.js
git commit -m "feat: add uninstallHooks preserving unrelated entries"
```

---

### Task 7: CLI entry point + init command

**Files:**
- Create: `bin/cli.js`
- Create: `lib/commands/init.js`

- [ ] **Step 1: Write `lib/commands/init.js`**

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SETTINGS_PATH, AGENTLIGHTS_DIR, SCRIPT_PATH } from '../paths.js';
import { readSettings, writeSettings, installHooks } from '../settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_SCRIPT = path.resolve(__dirname, '../../scripts/colorize.sh');

export async function init() {
  await fs.mkdir(AGENTLIGHTS_DIR, { recursive: true });
  const scriptContents = await fs.readFile(PACKAGE_SCRIPT, 'utf8');
  await fs.writeFile(SCRIPT_PATH, scriptContents, { mode: 0o755 });

  const settings = await readSettings(SETTINGS_PATH);
  const next = installHooks(settings, SCRIPT_PATH);
  await writeSettings(SETTINGS_PATH, next);

  console.log(`✓ Installed colorize.sh to ${SCRIPT_PATH}`);
  console.log(`✓ Wired hooks into ${SETTINGS_PATH}`);
  console.log(`Run 'npx agentlights test' to preview the color.`);
}
```

- [ ] **Step 2: Write `bin/cli.js`**

```js
#!/usr/bin/env node
import { init } from '../lib/commands/init.js';

const commands = { init };

const cmd = process.argv[2];

if (!cmd || !commands[cmd]) {
  console.log(`Usage: agentlights <command>

Commands:
  init       Wire up Claude Code hooks
  uninstall  Remove hooks and script
  doctor     Verify installation
  test       Preview the waiting color in this terminal`);
  process.exit(cmd ? 1 : 0);
}

try {
  await commands[cmd]();
} catch (err) {
  console.error(`agentlights: ${err.message}`);
  process.exit(1);
}
```

- [ ] **Step 3: Make CLI executable**

Run: `chmod +x bin/cli.js`

- [ ] **Step 4: Run CLI with no args**

Run: `node bin/cli.js`
Expected: prints usage, exits 0.

- [ ] **Step 5: Run CLI with unknown command**

Run: `node bin/cli.js bogus; echo "exit=$?"`
Expected: prints usage, `exit=1`.

- [ ] **Step 6: Run init against a sandboxed HOME**

```bash
export TMPHOME=$(mktemp -d)
HOME="$TMPHOME" node bin/cli.js init
cat "$TMPHOME/.claude/settings.json"
ls -l "$TMPHOME/.claude/agentlights/colorize.sh"
```

Expected:
- `settings.json` contains `hooks.Stop`, `hooks.UserPromptSubmit`, `hooks.SessionEnd` each with one entry pointing at `colorize.sh`.
- `colorize.sh` exists and is mode 755.

- [ ] **Step 7: Run init twice (idempotency)**

```bash
HOME="$TMPHOME" node bin/cli.js init
cat "$TMPHOME/.claude/settings.json"
```

Expected: each event array still has exactly one entry.

- [ ] **Step 8: Clean up**

Run: `rm -rf "$TMPHOME"`

- [ ] **Step 9: Commit**

```bash
git add bin/cli.js lib/commands/init.js
git commit -m "feat: add CLI dispatch and init command"
```

---

### Task 8: uninstall command

**Files:**
- Create: `lib/commands/uninstall.js`
- Modify: `bin/cli.js`

- [ ] **Step 1: Write `lib/commands/uninstall.js`**

```js
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
```

- [ ] **Step 2: Wire `uninstall` into `bin/cli.js`**

Modify `bin/cli.js` — add the import and entry:

```js
#!/usr/bin/env node
import { init } from '../lib/commands/init.js';
import { uninstall } from '../lib/commands/uninstall.js';

const commands = { init, uninstall };
```

(Leave the rest of `bin/cli.js` unchanged.)

- [ ] **Step 3: Test init then uninstall round-trip**

```bash
export TMPHOME=$(mktemp -d)
HOME="$TMPHOME" node bin/cli.js init
HOME="$TMPHOME" node bin/cli.js uninstall
cat "$TMPHOME/.claude/settings.json"
ls "$TMPHOME/.claude/agentlights" 2>&1
rm -rf "$TMPHOME"
```

Expected:
- `settings.json` is `{}\n` (or `{}` followed by newline) — no `hooks` key remaining.
- `agentlights` directory does not exist (`ls` reports "No such file or directory").

- [ ] **Step 4: Test uninstall preserves unrelated hooks**

```bash
export TMPHOME=$(mktemp -d)
mkdir -p "$TMPHOME/.claude"
cat > "$TMPHOME/.claude/settings.json" <<'EOF'
{
  "hooks": {
    "Stop": [
      { "matcher": "", "hooks": [{ "type": "command", "command": "/usr/bin/notify" }] }
    ]
  }
}
EOF
HOME="$TMPHOME" node bin/cli.js init
HOME="$TMPHOME" node bin/cli.js uninstall
cat "$TMPHOME/.claude/settings.json"
rm -rf "$TMPHOME"
```

Expected: `settings.json` contains only the user's `/usr/bin/notify` Stop hook; agentlights entries removed.

- [ ] **Step 5: Commit**

```bash
git add lib/commands/uninstall.js bin/cli.js
git commit -m "feat: add uninstall command"
```

---

### Task 9: doctor command

**Files:**
- Create: `lib/commands/doctor.js`
- Modify: `bin/cli.js`

- [ ] **Step 1: Write `lib/commands/doctor.js`**

```js
import fs from 'node:fs/promises';
import { SETTINGS_PATH, SCRIPT_PATH } from '../paths.js';
import { readSettings, isOurEntry } from '../settings.js';

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

  const color = process.env.AGENTLIGHTS_WAITING_COLOR ?? '#2a2733';
  console.log(`  Configured waiting color: ${color}`);

  if (!allOk) {
    console.log(`\nRun 'npx agentlights init' to repair.`);
    process.exit(1);
  }
}
```

- [ ] **Step 2: Wire `doctor` into `bin/cli.js`**

Modify the imports and `commands` object:

```js
#!/usr/bin/env node
import { init } from '../lib/commands/init.js';
import { uninstall } from '../lib/commands/uninstall.js';
import { doctor } from '../lib/commands/doctor.js';

const commands = { init, uninstall, doctor };
```

- [ ] **Step 3: Test doctor on uninstalled state**

```bash
export TMPHOME=$(mktemp -d)
HOME="$TMPHOME" node bin/cli.js doctor; echo "exit=$?"
rm -rf "$TMPHOME"
```

Expected: prints all `✗` lines, exits 1.

- [ ] **Step 4: Test doctor on installed state**

```bash
export TMPHOME=$(mktemp -d)
HOME="$TMPHOME" node bin/cli.js init
HOME="$TMPHOME" node bin/cli.js doctor; echo "exit=$?"
rm -rf "$TMPHOME"
```

Expected: prints all `✓` lines, exits 0.

- [ ] **Step 5: Commit**

```bash
git add lib/commands/doctor.js bin/cli.js
git commit -m "feat: add doctor command"
```

---

### Task 10: test command (visual preview)

**Files:**
- Create: `lib/commands/test.js`
- Modify: `bin/cli.js`

- [ ] **Step 1: Write `lib/commands/test.js`**

```js
export async function test() {
  const color = process.env.AGENTLIGHTS_WAITING_COLOR ?? '#2a2733';
  console.log(`Setting background to ${color} for 3 seconds...`);
  process.stdout.write(`\x1b]11;${color}\x1b\\`);
  await new Promise((r) => setTimeout(r, 3000));
  process.stdout.write(`\x1b]111\x1b\\`);
  console.log(`Reset to default. If you saw the color change, you're good.`);
}
```

- [ ] **Step 2: Wire `test` into `bin/cli.js`**

Modify imports and `commands` object:

```js
#!/usr/bin/env node
import { init } from '../lib/commands/init.js';
import { uninstall } from '../lib/commands/uninstall.js';
import { doctor } from '../lib/commands/doctor.js';
import { test } from '../lib/commands/test.js';

const commands = { init, uninstall, doctor, test };
```

- [ ] **Step 3: Run the visual test in Ghostty**

Run (in a Ghostty pane): `node bin/cli.js test`
Expected: pane background goes subtle indigo for 3 seconds, then returns to theme default.

- [ ] **Step 4: Run with custom color env var**

Run: `AGENTLIGHTS_WAITING_COLOR=#225522 node bin/cli.js test`
Expected: pane goes dark green for 3 seconds.

- [ ] **Step 5: Commit**

```bash
git add lib/commands/test.js bin/cli.js
git commit -m "feat: add test command for visual preview"
```

---

### Task 11: Write README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# agentlights

Color your Claude Code terminal pane when Claude is waiting on you.

If you run multiple `claude` sessions in split terminal panes, `agentlights` gives each pane a subtle background tint when its Claude is idle and waiting on input — so you can tell at a glance which pane needs you.

## Install

```bash
npx agentlights init
```

That's it. This wires three Claude Code hooks (`Stop`, `UserPromptSubmit`, `SessionEnd`) and installs a small shell script at `~/.claude/agentlights/colorize.sh`. Existing hooks in your `~/.claude/settings.json` are preserved — agentlights appends, never overwrites.

## Verify

```bash
npx agentlights test
```

Your pane background should turn a subtle indigo for 3 seconds, then return to default. If it does, you're set.

## Customize the color

```bash
export AGENTLIGHTS_WAITING_COLOR=#3a2a40
```

Any hex color works. Add it to your shell rc to make it permanent.

## Uninstall

```bash
npx agentlights uninstall
```

Removes only the hooks and files agentlights added.

## How it works

Claude Code's `Stop` hook fires when Claude finishes a turn. agentlights' hook script writes an [OSC 11 escape sequence](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html) (a standard ANSI control code) to the controlling terminal, which tells Ghostty (and most modern terminals) to repaint the background. `UserPromptSubmit` and `SessionEnd` hooks emit OSC 111 to reset.

Each terminal pane is independently signaled because OSC sequences only affect the surface that received them. No daemon, no IPC, no Ghostty plugin.

## Compatibility

Tested on Ghostty. Should work in any terminal that supports OSC 11 + 111 (iTerm2, kitty, WezTerm, Alacritty), but those aren't officially verified yet — PRs welcome.

## Troubleshooting

```bash
npx agentlights doctor
```

Verifies the script is present and executable, the hooks are wired, and prints your configured color.

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

### Task 12: End-to-end verification with a real Claude Code session

**Files:** none (manual verification)

- [ ] **Step 1: Install from local checkout**

Run: `npm link`
Expected: `agentlights` CLI is now globally available.

Verify: `which agentlights`
Expected: prints a path under your npm prefix.

- [ ] **Step 2: Run init**

Run: `agentlights init`
Expected: success messages, `~/.claude/settings.json` updated, `~/.claude/agentlights/colorize.sh` created.

- [ ] **Step 3: Verify hooks are wired**

Run: `agentlights doctor`
Expected: all `✓`, exit 0.

- [ ] **Step 4: Run a real Claude Code session in Ghostty**

In a Ghostty pane:
1. Run `claude`.
2. Submit a prompt (e.g., "what is 2+2?").
3. While Claude is responding, the pane background should remain default.
4. When Claude finishes its turn, the pane background should change to subtle indigo.
5. Submit another prompt — background should reset to default immediately.
6. Type `/exit` or Ctrl-D — pane should reset to default on session end.

If any step fails, run `agentlights doctor` and check the output.

- [ ] **Step 5: Test alongside another existing hook (regression check)**

If you already have a `Stop` hook (e.g., a desktop notification), confirm it still fires alongside the agentlights color change. Both should run.

- [ ] **Step 6: Uninstall and verify clean removal**

Run: `agentlights uninstall`
Then: `agentlights doctor`
Expected: all `✗`, exit 1. `~/.claude/settings.json` no longer contains agentlights entries; pre-existing entries preserved.

- [ ] **Step 7: Reinstall (so you get to use it)**

Run: `agentlights init`

- [ ] **Step 8: Tag v0.1.0**

```bash
git tag v0.1.0
git log --oneline -1
```

- [ ] **Step 9: Final commit (none expected — sanity check)**

Run: `git status`
Expected: working tree clean.

---

## Out of Scope (do not implement)

- Per-state colors beyond "waiting" / default
- Per-project color overrides
- Config file format
- Auto-detection of light vs. dark theme
- "Working" color while Claude is mid-turn
- Officially-tested support for non-Ghostty terminals
- npm publish (separate manual step once you've used it for a few days and confirmed nothing is broken)
