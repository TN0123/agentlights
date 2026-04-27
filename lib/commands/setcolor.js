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
