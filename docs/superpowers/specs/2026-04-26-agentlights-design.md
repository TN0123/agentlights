# agentlights — Design Spec

**Date:** 2026-04-26
**Status:** Approved — ready for implementation planning

## Summary

`agentlights` is an open-source npm package that gives Claude Code's terminal a visual "waiting on you" state by changing the terminal background color when Claude finishes a turn and resetting it when the user submits a new prompt. Designed for users running multiple Claude Code instances across split terminal panes (primary use case: Ghostty), so they can see at a glance which pane needs attention.

Install with one command: `npx agentlights init`.

## Problem

Users running multiple `claude` sessions in split terminal panes have no peripheral cue for which session is idle and waiting on input vs. still working. They have to focus each pane individually to check status. A subtle pane-level visual signal solves this without context-switching.

## Goals

- Zero-config install: one `npx` command wires everything up.
- Per-pane signaling: each terminal surface independently reflects its own Claude state.
- Visually subtle by default, customizable via env var.
- No daemon, no Ghostty IPC, no platform-specific extensions.

## Non-Goals (v1)

- Per-state colors beyond "waiting" and default (no separate "needs permission" color).
- Per-project color overrides.
- Config file format.
- Auto-detection of light vs. dark theme.
- An "actively working" color while Claude is mid-turn.
- Officially-tested support for terminals other than Ghostty.
- Any GUI, TUI, or daemon process.

## How It Works

The mechanism is two well-defined APIs meeting in a 15-line shell script:

1. **Claude Code hooks** fire shell commands at lifecycle events (`Stop`, `UserPromptSubmit`, `SessionEnd`), passing JSON on stdin.
2. **OSC 11** is a standard ANSI escape sequence (`\033]11;#hex\033\\`) that tells the terminal to repaint its background. It only affects the surface that received it, so each pane is naturally isolated. **OSC 111** resets to the theme default.

Lifecycle:

```
[User submits prompt]
    └─ UserPromptSubmit hook → colorize.sh reset → OSC 111 → pane returns to default

[Claude works...]

[Claude finishes turn]
    └─ Stop hook → colorize.sh waiting → OSC 11;#2a2733 → pane goes subtle indigo

[User looks over, sees indigo, replies]
    └─ UserPromptSubmit fires again → reset → loop

[Claude session ends or crashes]
    └─ SessionEnd hook → colorize.sh reset → ensures pane isn't left tinted
```

## Architecture

### Components

```
agentlights/
├── package.json              # npm package, "bin": { "agentlights": "./bin/cli.js" }
├── bin/
│   └── cli.js                # Node CLI: init, uninstall, doctor, test
├── scripts/
│   └── colorize.sh           # The shell script the hooks call
├── README.md                 # Install, screenshots, env vars, troubleshooting
├── LICENSE                   # MIT
└── test/
    └── cli.test.js           # Tests for JSON merging logic
```

### `scripts/colorize.sh`

POSIX shell, ~15 lines. Takes one argument: `waiting` or `reset`. Reads `AGENTLIGHTS_WAITING_COLOR` env var (default `#2a2733` — subtle dark indigo). Writes the OSC sequence to `/dev/tty` so it reaches the controlling terminal even if hook stdout is captured. Exits 0 unconditionally so it can never block Claude.

```sh
#!/usr/bin/env sh
color="${AGENTLIGHTS_WAITING_COLOR:-#2a2733}"
case "$1" in
  waiting) printf '\033]11;%s\033\\' "$color" > /dev/tty 2>/dev/null ;;
  reset)   printf '\033]111\033\\'         > /dev/tty 2>/dev/null ;;
esac
exit 0
```

Installed to `~/.claude/agentlights/colorize.sh` and chmod +x by `init`.

### `bin/cli.js`

Node script (no build step, no TypeScript). Subcommands:

- **`init`** — Locates `~/.claude/settings.json`. Parses it. Appends entries to `hooks.Stop`, `hooks.UserPromptSubmit`, and `hooks.SessionEnd` arrays (creating them if missing). Each entry calls `~/.claude/agentlights/colorize.sh <state>`. Idempotent: detects already-installed entries by stable command path and skips. Copies `colorize.sh` from package to `~/.claude/agentlights/colorize.sh` and chmods it.

- **`uninstall`** — Removes hook entries that point at our script (matched by command path) and deletes `~/.claude/agentlights/`.

- **`doctor`** — Verifies hooks are present in settings.json, script exists and is executable, and prints the configured color. Diagnoses common breakage.

- **`test`** — Emits the "waiting" sequence to the current terminal so the user sees the color, waits 3 seconds, resets. Pure sanity check, requires no Claude Code session.

### Hook entries written to `~/.claude/settings.json`

```json
{
  "hooks": {
    "Stop": [
      { "matcher": "", "hooks": [{ "type": "command",
        "command": "~/.claude/agentlights/colorize.sh waiting" }] }
    ],
    "UserPromptSubmit": [
      { "matcher": "", "hooks": [{ "type": "command",
        "command": "~/.claude/agentlights/colorize.sh reset" }] }
    ],
    "SessionEnd": [
      { "matcher": "", "hooks": [{ "type": "command",
        "command": "~/.claude/agentlights/colorize.sh reset" }] }
    ]
  }
}
```

If the user already has entries in any of these arrays, our entries are appended, not overwritten.

## The Risky Bit — JSON Merge Logic

This is the only place real bugs hide. Requirements:

- **Append, never overwrite.** User may have existing `Stop` hooks for other purposes (linting, notifications, etc.).
- **Idempotent.** Running `init` twice must not duplicate entries. Detection: match on the stable command path `~/.claude/agentlights/colorize.sh`.
- **Survives a missing `hooks` key, missing event arrays, or a missing settings.json file** (create it).
- **Bails on malformed JSON.** Don't try to repair it; print a clear error and exit non-zero.
- **Round-trips through `JSON.parse` / `JSON.stringify`.** Standard JSON has no comments, so nothing to preserve. Indentation: 2 spaces (matches Claude Code's default).

## Defaults & Customization

| Knob | Default | How to override |
|---|---|---|
| Waiting color | `#2a2733` (subtle indigo) | `AGENTLIGHTS_WAITING_COLOR=#hex` env var |
| Install location for script | `~/.claude/agentlights/colorize.sh` | Not configurable in v1 |
| States | waiting / default | Not configurable in v1 |

## Edge Cases

| Scenario | Behavior |
|---|---|
| Claude crashes mid-turn | `SessionEnd` hook fires → resets pane. |
| User Ctrl-Cs Claude | `SessionEnd` fires → resets. |
| Terminal closed mid-state | Color dies with the pane; new pane starts at theme default. |
| User has existing `Stop` hook | Appended to, not overwritten. |
| `settings.json` doesn't exist | Created with our hooks. |
| `settings.json` is malformed JSON | Hard error, no auto-repair. |
| User runs `init` twice | No-op the second time (idempotent). |
| Non-Ghostty terminal | Works in any terminal supporting OSC 11/111 (iTerm2, kitty, WezTerm) but officially untested in v1. README says: PRs welcome to formalize. |

## Testing Strategy

Proportional to risk.

- **Unit tests** (Node built-in `node:test`, no framework) for JSON merging:
  - Empty `settings.json`
  - `settings.json` with unrelated hooks
  - `settings.json` with our hooks already installed (idempotency)
  - Malformed JSON (must error cleanly)
  - Missing `hooks` key
  - Missing event arrays
- **Manual smoke test** via the built-in `agentlights test` subcommand for the visual confirmation. Documented in README.
- **No tests for OSC emission itself.** Three lines of `printf`; testing requires pseudo-tty harness, negative ROI. The `test` subcommand serves as the integration test.

## Packaging & Distribution

- npm package name: `agentlights`
- No build step — plain JS, plain shell. Source matches what gets published.
- `package.json` `bin` field exposes `agentlights` for `npx`.
- Node engines: `>=18` (matches Claude Code's minimum; built-in `fetch` available; no polyfills).
- License: MIT.
- GitHub repo: `agentlights` under user's account. Topics: `claude-code`, `ghostty`, `terminal`, `hooks`.

## README Structure

1. One-line description + animated GIF/screenshot of color change in a split pane.
2. Install: `npx agentlights init`.
3. Verify: `npx agentlights test`.
4. Customize: `export AGENTLIGHTS_WAITING_COLOR=#your-hex`.
5. Uninstall: `npx agentlights uninstall`.
6. How it works (one paragraph: Claude Code `Stop` hook → OSC 11 → Ghostty pane).
7. Compatibility note: tested on Ghostty; likely works in iTerm2/kitty/WezTerm but unverified — PRs welcome.
8. Troubleshooting: `npx agentlights doctor`.

## References

- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- [Ghostty OSC 11 discussion](https://github.com/ghostty-org/ghostty/discussions/4788)
- [Ghostty control sequences](https://ghostty.org/docs/vt/concepts/sequences)
- Comparable tools studied: [karanb192/claude-code-hooks](https://github.com/karanb192/claude-code-hooks), [johnlindquist/claude-hooks](https://github.com/johnlindquist/claude-hooks), [disler/claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery)
