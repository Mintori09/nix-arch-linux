# Smart tmux launcher & session switcher:
# - If session name argument given (`t <name>`):
#   - Attach if exists, otherwise create new session with that name.
# - If no argument (`t`):
#   - Find existing main session (excluding popup sessions like agy-*, term-*, opencode-*, pi-*, btop-*, lazygit-*)
#     matching git root or current directory, then attach/switch.
#   - If none found: create new main session named after git project root (or directory).
t() {
	if [ "$" -gt 0 ]; then
		local sess_name="$1"
		if [ -n "$TMUX" ]; then
			command tmux has-session -t "$sess_name" 2>/dev/null ||
				command tmux new-session -d -s "$sess_name" -c "$PWD"
			command tmux switch-client -t "$sess_name"
		else
			command tmux new-session -A -s "$sess_name" -c "$PWD"
		fi
		return $?
	fi

	# No argument: find main session (ignore popups: agy-*, term-*, opencode-*, pi-*, btop-*, lazygit-*)
	local current_dir="$PWD"
	local git_root
	git_root="$(command git rev-parse --show-toplevel 2>/dev/null || true)"
	local target_dir="${git_root:-$current_dir}"
	local matched_sess

	# Check pane paths first, then session paths (excluding helper/popup sessions)
	matched_sess="$(command tmux list-panes -a -F "#{session_name}	#{pane_current_path}" 2>/dev/null |
		awk -F'\t' -v root="$target_dir" -v curr="$current_dir" '$1 !~ /^(agy|term|opencode|pi|btop|lazygit)-/ && ($2 == root || $2 == curr) { print $1; exit }')"

	if [ -z "$matched_sess" ]; then
		matched_sess="$(command tmux list-sessions -F "#{session_name}	#{session_path}" 2>/dev/null |
			awk -F'\t' -v root="$target_dir" -v curr="$current_dir" '$1 !~ /^(agy|term|opencode|pi|btop|lazygit)-/ && ($2 == root || $2 == curr) { print $1; exit }')"
	fi

	if [ -n "$matched_sess" ]; then
		if [ -n "$TMUX" ]; then
			command tmux switch-client -t "$matched_sess"
		else
			command tmux attach-session -t "$matched_sess"
		fi
	else
		local new_name
		new_name="$(basename "$target_dir" | tr '.: ' '---')"
		[ -z "$new_name" ] && new_name="main"

		if [ -n "$TMUX" ]; then
			command tmux has-session -t "$new_name" 2>/dev/null ||
				command tmux new-session -d -s "$new_name" -c "$target_dir"
			command tmux switch-client -t "$new_name"
		else
			command tmux new-session -A -s "$new_name" -c "$target_dir"
		fi
	fi
}
