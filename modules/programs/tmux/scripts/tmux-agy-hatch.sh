#!/usr/bin/env bash
set -euo pipefail

cmd="${1:-}"

case "$cmd" in
launch)
	raw_path="${2:-$PWD}"
	origin_win="${3:-}"
	origin_sess="${4:-}"

	current_session="$(tmux display-message -p '#{session_name}' 2>/dev/null || true)"

	# If invoked from within a popup/helper session, find the origin window/tab's path
	if [[ $current_session =~ ^(agy|term|opencode|pi|btop|lazygit)- ]]; then
		orig_win="$(tmux show-options -qv -t "$current_session" @origin_window 2>/dev/null || true)"
		if [ -n "$orig_win" ]; then
			win_path="$(tmux display-message -p -t "$orig_win" '#{pane_current_path}' 2>/dev/null || true)"
			[ -n "$win_path" ] && raw_path="$win_path"
		fi
		if [ -z "${win_path:-}" ]; then
			parent_path="$(tmux show-options -qv -t "$current_session" @origin_path 2>/dev/null || true)"
			if [ -z "$parent_path" ]; then
				parent_path="$(tmux show-options -qv -t "$current_session" @agy_path 2>/dev/null || true)"
			fi
			[ -n "$parent_path" ] && raw_path="$parent_path"
		fi
	fi

	# Resolve git root based on the active tab/window's path
	git_root="$(git -C "$raw_path" rev-parse --show-toplevel 2>/dev/null || true)"
	path="${git_root:-$raw_path}"
	session="agy-$(echo "$path" | md5sum | cut -c1-8)"

	if [ "$current_session" = "$session" ]; then
		exit 0
	fi

	if ! tmux has-session -t "$session" 2>/dev/null; then
		[ -d "$path" ] || {
			tmux display-message "Directory $path does not exist"
			exit 0
		}
		tmux new-session -d -s "$session" -c "$path" "agy --dangerously-skip-permissions"
	fi

	tmux set-option -t "$session" detach-on-destroy on 2>/dev/null || true
	tmux set-option -t "$session" @origin_path "$path" 2>/dev/null || true
	[ -n "$origin_win" ] && tmux set-option -t "$session" @origin_window "$origin_win" 2>/dev/null || true
	[ -n "$origin_win" ] && tmux set-option -t "$session" @agy_origin "$origin_win" 2>/dev/null || true
	[ -n "$origin_sess" ] && tmux set-option -t "$session" @origin_session "$origin_sess" 2>/dev/null || true
	tmux set-option -t "$session" @agy_path "$path" 2>/dev/null || true

	case "$current_session" in
	agy-* | term-* | opencode-* | pi-* | btop-* | lazygit-*)
		tmux switch-client -t "$session"
		;;
	*)
		proj_name="$(basename "$path")"
		title=" 󰚩 Antigravity  $proj_name "
		tmux display-popup -w 85% -h 89% -b rounded -T "$title" -E "tmux attach-session -t '$session'"
		;;
	esac
	;;

list)
	sessions="$(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep '^agy-' || true)"
	[ -z "$sessions" ] && exit 0

	while IFS= read -r sess; do
		[ -z "$sess" ] && continue
		pane_id="$(tmux list-panes -t "$sess" -F '#{pane_id}' 2>/dev/null | head -n1)"
		path="$(tmux show-options -qv -t "$sess" @agy_path 2>/dev/null || true)"
		[ -z "$path" ] && path="$(tmux list-panes -t "$sess" -F '#{pane_current_path}' 2>/dev/null | head -n1)"
		origin="$(tmux show-options -qv -t "$sess" @agy_origin 2>/dev/null || true)"

		status="● idle"
		color="\033[32m"
		rank=2

		pane_pid="$(tmux list-panes -t "$sess" -F '#{pane_pid}' 2>/dev/null | head -n1)"
		if pgrep -P "$pane_pid" agy >/dev/null 2>&1 || [ "$(ps -p "$pane_pid" -o comm= 2>/dev/null)" = "agy" ]; then
			tail_text="$(tmux capture-pane -pt "$pane_id" 2>/dev/null | tail -n 12)"
			if echo "$tail_text" | grep -qE "(\?|❯|\[Y/n\]|\(y/n\)|Prompt:|waiting)"; then
				status="● waiting"
				color="\033[33m"
				rank=0
			else
				status="● working"
				color="\033[34m"
				rank=1
			fi
		else
			status="● finished"
			color="\033[90m"
			rank=3
		fi

		proj_name="$(basename "$path")"
		home_path="$path"
		if [[ $path == "$HOME"* ]]; then
			home_path="~${path#$HOME}"
		fi

		printf "%s\t%s\t%s\t%s\t%b%s\033[0m\t%s\t%s\n" \
			"$rank" "$sess" "$pane_id" "$origin" "$color" "$status" "$proj_name" "$home_path"
	done <<<"$sessions" | sort -t$'\t' -k1,1n
	;;

picker)
	sessions="$(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep '^agy-' || true)"
	if [ -z "$sessions" ]; then
		tmux display-message "No active Antigravity sessions found"
		exit 0
	fi

	self="$0"
	sel="$(
		"$self" list | fzf \
			--ansi \
			--delimiter='\t' \
			--with-nth=5,6,7 \
			--reverse \
			--cycle \
			--header='󰚩 Antigravity Agents · enter: jump · ctrl-x: kill · esc: quit' \
			--preview='tmux capture-pane -ept {3}' \
			--preview-window='right,65%,follow' \
			--bind="ctrl-x:execute-silent(tmux kill-session -t {2})+reload($self list)"
	)" || exit 0

	[ -z "$sel" ] && exit 0

	target_sess="$(echo "$sel" | cut -f2)"

	tmux switch-client -t "$target_sess"
	;;

bell)
	hook_session="${2:-}"
	case "$hook_session" in
	agy-*)
		origin="$(tmux show-options -qv -t "$hook_session" @agy_origin 2>/dev/null || true)"
		[ -n "$origin" ] || exit 0

		origin_session="$(tmux display-message -p -t "$origin" '#{session_name}' 2>/dev/null || true)"
		[[ $origin_session == agy-* ]] && exit 0

		tty="$(tmux display-message -p -t "$origin" '#{pane_tty}' 2>/dev/null || true)"
		[ -n "$tty" ] && printf '\a' >"$tty" 2>/dev/null || true
		;;
	*)
		exit 0
		;;
	esac
	;;

*)
	echo "Usage: tmux-agy-hatch {launch <path> [origin_window] [origin_session]|list|picker|bell <session>}"
	exit 1
	;;
esac
