# `agentlights setcolor` — Design Spec

**Date:** 2026-04-27
**Status:** Approved — ready for implementation planning

## Summary

Add an interactive `npx agentlights setcolor` command that lets users browse a palette of preset background colors with arrow-key navigation, see each candidate applied to the terminal pane in real time, optionally enter a custom hex color, and persist their choice so the existing hook script picks it up on the next `Stop` event.

## Problem

Today the only way to change the waiting color is to set `AGENTLIGHTS_WAITING_COLOR` in a shell rc file and restart the shell. There is no discoverability ("what colors look good as a subtle background?"), no preview ("will this look right in my terminal theme?"), and no way to set a value from the agentlights CLI itself. Users have to guess hex codes and edit dotfiles.

## Goals

- One-command color selection: `npx agentlights setcolor`.
- Live preview: highlighted color is applied to the pane while the user navigates.
- A curated default palette of 10 subtle, dark-tinted colors that work as background washes.
- Support for arbitrary user-supplied hex colors.
- Persisted choice survives shell restart and is read by the existing `colorize.sh` hook script without further user action.
- Env var (`AGENTLIGHTS_WAITING_COLOR`) remains a hard override so power users keep control.
- No new runtime dependencies.

## Non-Goals

- A full TUI library / mouse support / themed UI chrome.
- Multiple named profiles or per-project overrides.
- Importing colors from terminal themes or system appearance.
- Editing the user's shell rc files.
- Configuring colors for any state other than "waiting".

## UX

```
$ npx agentlights setcolor

Use ↑/↓ to preview, Enter to save, Esc to cancel.

  Indigo      #2a2733  ← current
> Slate       #2a2d33
  Navy        #232838
  Teal        #1f2e2e
  Forest      #232b25
  Plum        #2e2433
  Charcoal    #262626
  Slate Blue  #252a35
  Sage        #2a2e28
  Deep Rose   #332428
  Custom...
```

### Interaction

- **↑ / ↓**: move highlight by one row, wrapping at top/bottom. On every move emit `OSC 11;<hex>` so the pane recolors live. For the `Custom...` row, do not emit anything (no preview color yet).
- **Enter** on a preset row: save that color, emit `OSC 111` to clear the preview tint, exit with success.
- **Enter** on `Custom...`: leave the menu, prompt `Hex color: `, validate `#rgb` or `#rrggbb` (case-insensitive). On valid input, save and exit. On invalid input, print an inline error and re-prompt. Empty input cancels back to the picker.
- **Esc, q, or Ctrl+C**: emit `OSC 111`, exit without saving (exit code 0 for Esc/q, 130 for Ctrl+C).
- **Initial highlight**: the saved color if it matches a preset (case-insensitively); otherwise `Custom...`. The current saved color is annotated `← current` next to its row.

### Non-interactive fallback

If `process.stdin.isTTY` is false (piped, CI, etc.), print `setcolor requires an interactive terminal` and exit 1. No prompts, no preview.

## Persistence

A new shell-sourceable file `~/.claude/agentlights/config.sh` is the source of truth for the saved color:

```sh
# Written by `agentlights setcolor`. Edit via the CLI.
AGENTLIGHTS_WAITING_COLOR_DEFAULT="#2a2d33"
```

Format rules:
- Always exactly one assignment line for `AGENTLIGHTS_WAITING_COLOR_DEFAULT`.
- Value always double-quoted.
- File is fully rewritten on save (no preserve-other-lines logic) — this file is owned by agentlights.

### Updated `scripts/colorize.sh`

```sh
#!/usr/bin/env sh
# agentlights — emits OSC 11 / OSC 111 to the controlling terminal
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

Precedence (highest first):
1. `AGENTLIGHTS_WAITING_COLOR` env var (existing override behavior, unchanged).
2. `AGENTLIGHTS_WAITING_COLOR_DEFAULT` from `config.sh` (new).
3. Built-in fallback `#2a2733` (unchanged).

### Migration / install

- Existing users running `npx agentlights init` get the updated `colorize.sh` on next install. Until they re-run `init`, their old script ignores `config.sh` — a `setcolor` invocation will save the file but it will have no effect on the pane until they re-init. To detect this, `setcolor` reads `~/.claude/agentlights/colorize.sh` after saving; if the file exists but does not contain the substring `config.sh`, it prints a one-line warning telling the user to run `npx agentlights init` to pick up the new script.
- Users who have never run `init` can still use `setcolor`; it creates `~/.claude/agentlights/` and writes `config.sh`. The picker still previews colors regardless of install state.

## Default Palette

10 subtle, cool-leaning dark colors suitable as background washes (option A from brainstorming):

| Name       | Hex       |
|------------|-----------|
| Indigo     | `#2a2733` |
| Slate      | `#2a2d33` |
| Navy       | `#232838` |
| Teal       | `#1f2e2e` |
| Forest     | `#232b25` |
| Plum       | `#2e2433` |
| Charcoal   | `#262626` |
| Slate Blue | `#252a35` |
| Sage       | `#2a2e28` |
| Deep Rose  | `#332428` |

`Indigo` (`#2a2733`) matches the existing built-in default, so users who never customized see their familiar color highlighted as the current value.

## Code Structure

### New files

- **`lib/colors.js`**
  - `export const PRESETS` — array of `{ name, hex }` in display order.
  - `export function isValidHex(s)` — accepts `#rgb` or `#rrggbb` (case-insensitive), returns boolean.
  - `export function normalizeHex(s)` — lowercases and expands `#rgb` → `#rrggbb` for storage/comparison.

- **`lib/config.js`**
  - `export async function readSavedColor()` → `string | null`. Reads `~/.claude/agentlights/config.sh`, parses the `AGENTLIGHTS_WAITING_COLOR_DEFAULT="..."` line with a regex, returns the hex (or `null` if file missing or no match).
  - `export async function writeSavedColor(hex)` — creates `~/.claude/agentlights/` if needed, writes the full file content (header comment + one assignment line).
  - `export const CONFIG_PATH` — exported for tests and reuse.

- **`lib/commands/setcolor.js`** — the interactive picker.
  - Checks `process.stdin.isTTY`, errors if non-TTY.
  - Reads saved color via `readSavedColor()`; computes initial highlight index.
  - Builds the menu (presets + `Custom...`).
  - Sets raw mode, enables `readline.emitKeypressEvents`, hides the cursor.
  - On each keypress: handles `up`/`down`/`return`/`escape`/`q`/`ctrl+c`. Re-renders the menu in place using ANSI cursor-up + line-clear so it doesn't scroll.
  - On every move, emits OSC 11 with the highlighted hex (skipped for `Custom...`).
  - On save (Enter on preset): emits OSC 111, calls `writeSavedColor`, prints `Saved <hex>. Next time Claude finishes a turn, your pane will tint to this color.`, exits 0.
  - On Custom selected: tears down raw mode, prompts via `readline.createInterface`, validates loop, then save path above.
  - On cancel: emits OSC 111, prints `Cancelled.`, exits 0 (130 for Ctrl+C).
  - Wraps the whole flow in a `try`/`finally` that always restores raw mode, shows the cursor, and emits OSC 111 even on uncaught errors.
  - Installs a SIGINT handler that performs the same cleanup.

### Modified files

- **`bin/cli.js`** — register `setcolor`; add to usage block.
- **`scripts/colorize.sh`** — source `config.sh` and consult `AGENTLIGHTS_WAITING_COLOR_DEFAULT` (see snippet above).
- **`lib/commands/test.js`** — also consult `readSavedColor()` so `npx agentlights test` previews the saved color, not just the env var or built-in default. Precedence matches the shell script.
- **`lib/commands/doctor.js`** — same: report saved color in the "configured waiting color" line, with the source (`env`, `saved`, or `default`).
- **`lib/paths.js`** — export `CONFIG_PATH` constant for the new file.

### New tests (`test/`)

- **`colors.test.js`**
  - `isValidHex` accepts `#abc`, `#aAbBcC`, rejects `abc`, `#ab`, `#abcd`, `#gggggg`, empty.
  - `normalizeHex('#aBc')` returns `#aabbcc`.
  - `PRESETS` has exactly 10 entries, all valid hex, all unique, all distinct names.

- **`config.test.js`**
  - `readSavedColor()` returns `null` when file missing.
  - `writeSavedColor` then `readSavedColor` round-trips.
  - `readSavedColor` returns `null` on a file with no matching assignment line.
  - `readSavedColor` ignores comments and unrelated lines.
  - `writeSavedColor` creates the parent directory if absent.

The interactive picker is **not** unit-tested (TTY behavior is awkward to harness for the value it adds). End-to-end verification: `setcolor` → `doctor` reports the new color → `test` shows the new color.

## Edge Cases

- **Saved color is invalid hex** (file hand-edited to garbage) → `readSavedColor` returns `null`; the picker treats it as "no current", initial highlight is `Indigo` (the first preset), no `← current` annotation.
- **Custom hex is `#abc` short form** → normalized to `#aabbcc` before saving.
- **Terminal doesn't support OSC 11** → preview just doesn't happen; the picker still works and saves successfully. (Same constraint as the rest of agentlights.)
- **Window resize during picker** → ignored. Re-render on next keypress will fix layout.
- **User has `AGENTLIGHTS_WAITING_COLOR` set in env** → `setcolor` still saves to `config.sh`, but the saved value won't take effect until the env var is unset. Print a one-line warning at the end: `Note: AGENTLIGHTS_WAITING_COLOR is set in your environment and will override this saved value.`

## Out of Scope (Explicit)

- A "reset to default" menu item (user can pick `Indigo` from presets).
- A "remove saved color" command (delete `config.sh` manually if needed).
- Color names rendered in their own color in the menu (would require true-color rendering and accessibility considerations).
- Recently-used or favorite colors.
