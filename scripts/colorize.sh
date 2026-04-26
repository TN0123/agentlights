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
