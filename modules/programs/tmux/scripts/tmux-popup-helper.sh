#!/usr/bin/env bash
set -euo pipefail

prefix="${1:-term}"
raw_path="${2:-$PWD}"
origin_win="${3:-}"
origin_sess="${4:-}"
cmd="${5:-}"

current_session="$(tmux display-message -p '#{session_name}' 2>/dev/null || true)"

# If invoked from within a popup, find the parent's origin tab path
if [[ $current_session =~ ^(agy|term|opencode|pi|btop|lazygit)- ]]; then
	orig_win="$(tmux show-options -qv -t "$current_session" @origin_window 2>/dev/null || true)"
	if [ -n "$orig_win" ]; then
		win_path="$(tmux display-message -p -t "$orig_win" '#{pane_current_path}' 2>/dev/null || true)"
		[ -n "$win_path" ] && raw_path="$win_path"
	fi
	if [ -z "${win_path:-}" ]; then
		parent_path="$(tmux show-options -qv -t "$current_session" @origin_path 2>/dev/null || true)"
		[ -n "$parent_path" ] && raw_path="$parent_path"
	fi
fi

case "$prefix" in
opencode | pi | lazygit)
	git_root="$(git -C "$raw_path" rev-parse --show-toplevel 2>/dev/null || true)"
	path="${git_root:-$raw_path}"
	;;
*)
	path="$raw_path"
	;;
esac

session="${prefix}-$(echo "$path" | md5sum | cut -c1-8)"

if [ "$current_session" = "$session" ]; then
	exit 0
fi

if ! tmux has-session -t "$session" 2>/dev/null; then
	[ -d "$path" ] || {
		tmux display-message "Directory $path does not exist"
		exit 0
	}
	if [ -n "$cmd" ]; then
		tmux new-session -d -s "$session" -c "$path" "$cmd"
	else
		tmux new-session -d -s "$session" -c "$path"
	fi
fi

tmux set-option -t "$session" detach-on-destroy on 2>/dev/null || true
tmux set-option -t "$session" @origin_path "$path" 2>/dev/null || true
[ -n "$origin_win" ] && tmux set-option -t "$session" @origin_window "$origin_win" 2>/dev/null || true
[ -n "$origin_sess" ] && tmux set-option -t "$session" @origin_session "$origin_sess" 2>/dev/null || true

case "$current_session" in
agy-* | term-* | opencode-* | pi-* | btop-* | lazygit-*)
	tmux switch-client -t "$session"
	;;
*)
	proj_name="$(basename "$path")"
	case "$prefix" in
	lazygit) title=" 󰊢 Lazygit  $proj_name " ;;
	opencode) title=" 󰚩 OpenCode  $proj_name " ;;
	pi) title=" 󱚣 Pi  $proj_name " ;;
	btop) title=" 󰓅 btop " ;;
	term) title="  Terminal  $proj_name " ;;
	*) title=" $prefix  $proj_name " ;;
	esac
	tmux display-popup -w 85% -h 89% -b rounded -T "$title" -E "tmux attach-session -t '$session'"
	;;
esac
