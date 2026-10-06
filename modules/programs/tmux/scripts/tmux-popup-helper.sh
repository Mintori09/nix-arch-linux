#!/usr/bin/env bash
set -euo pipefail

prefix="${1:-term}"
path="${2:-$PWD}"
cmd="${3:-}"

session="${prefix}-$(echo "$path" | md5sum | cut -c1-8)"
current_session="$(tmux display-message -p '#{session_name}' 2>/dev/null || true)"

if [ "$current_session" = "$session" ]; then
  exit 0
fi

if ! tmux has-session -t "$session" 2>/dev/null; then
  if [ -n "$cmd" ]; then
    tmux new-session -d -s "$session" -c "$path" "$cmd"
  else
    tmux new-session -d -s "$session" -c "$path"
  fi
fi

tmux set-option -t "$session" detach-on-destroy on 2>/dev/null || true

case "$current_session" in
  agy-*|term-*|opencode-*|pi-*|btop-*)
    tmux switch-client -t "$session"
    ;;
  *)
    tmux display-popup -w 85% -h 89% -b rounded -E "tmux attach-session -t '$session'"
    ;;
esac
