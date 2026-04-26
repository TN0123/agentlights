# agentlights

[![npm version](https://img.shields.io/npm/v/agentlights.svg)](https://www.npmjs.com/package/agentlights)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/agentlights.svg)](https://www.npmjs.com/package/agentlights)

Color your Claude Code terminal pane when Claude is waiting on you.

<!--
  Demo: drop a screen recording at docs/demo.gif (split panes, idle one glowing indigo),
  then uncomment the <p>…</p> block below to surface it at the top of the README.

<p align="center">
  <img src="docs/demo.gif" alt="agentlights demo: split terminal panes with the idle Claude Code pane glowing indigo" width="720">
</p>
-->

If you run **multiple Claude Code sessions in split terminal panes** and lose track of which pane is idle and waiting on input, `agentlights` gives each pane a subtle background tint the moment its Claude finishes a turn — so you can tell at a glance which pane needs you. It's a tiny shell script wired into Claude Code's [hooks](https://docs.anthropic.com/en/docs/claude-code/hooks); no daemon, no plugin, no IPC.

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

agentlights uses [OSC 11 / OSC 111](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html), which most modern terminals support.

| Terminal | Status |
|---|---|
| [Ghostty](https://ghostty.org) | Verified |
| iTerm2 | Likely works — verification needed |
| kitty | Likely works — verification needed |
| WezTerm | Likely works — verification needed |
| Alacritty | Likely works — verification needed |

If `npx agentlights test` works in a terminal not yet marked Verified, please [open an issue](https://github.com/TN0123/agentlights/issues/new) so the table can be updated. PRs welcome.

## Troubleshooting

```bash
npx agentlights doctor
```

Verifies the script is present and executable, the hooks are wired, and prints your configured color.

## License

MIT
