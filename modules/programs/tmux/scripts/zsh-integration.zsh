# Smart tmux launcher & session switcher:
# - If session name argument given (`t <name>`):
#   - Attach if exists, otherwise create new session with that name.
# - If no argument (`t`):
#   - Check if an existing tmux session is currently in $PWD: attach to it.
#   - If none found: create new session named after current directory.
t() {
  if [ "$#" -gt 0 ]; then
    local sess_name="$1"
    if [ -n "$TMUX" ]; then
      command tmux has-session -t "$sess_name" 2>/dev/null || \
        command tmux new-session -d -s "$sess_name" -c "$PWD"
      command tmux switch-client -t "$sess_name"
    else
      command tmux new-session -A -s "$sess_name" -c "$PWD"
    fi
    return $?
  fi

  # No argument: find session with matching path or create one
  local current_dir="$PWD"
  local matched_sess

  # Check pane paths first, then session paths
  matched_sess="$(command tmux list-panes -a -F "#{session_name}	#{pane_current_path}" 2>/dev/null | awk -F'\t' -v dir="$current_dir" '$2 == dir { print $1; exit }')"
  if [ -z "$matched_sess" ]; then
    matched_sess="$(command tmux list-sessions -F "#{session_name}	#{session_path}" 2>/dev/null | awk -F'\t' -v dir="$current_dir" '$2 == dir { print $1; exit }')"
  fi

  if [ -n "$matched_sess" ]; then
    if [ -n "$TMUX" ]; then
      command tmux switch-client -t "$matched_sess"
    else
      command tmux attach-session -t "$matched_sess"
    fi
  else
    local new_name
    new_name="$(basename "$current_dir" | tr '.: ' '---')"
    [ -z "$new_name" ] && new_name="main"

    if [ -n "$TMUX" ]; then
      command tmux has-session -t "$new_name" 2>/dev/null || \
        command tmux new-session -d -s "$new_name" -c "$current_dir"
      command tmux switch-client -t "$new_name"
    else
      command tmux new-session -A -s "$new_name" -c "$current_dir"
    fi
  fi
}
