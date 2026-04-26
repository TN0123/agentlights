# agentlights

[![npm version](https://img.shields.io/npm/v/agentlights.svg)](https://www.npmjs.com/package/agentlights)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/agentlights.svg)](https://www.npmjs.com/package/agentlights)

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
