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
