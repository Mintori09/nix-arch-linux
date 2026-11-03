#!/usr/bin/env bash
# AI Popup Terminal Toggle for KDE Wayland & Kitty + Tmux
set -euo pipefail

SESSION_NAME="ai-popup"
APP_ID="ai-popup-term"
TARGET_DIR="${AI_POPUP_DIR:-$HOME/.local/share/ai-popup}"

# Ensure target directory exists
mkdir -p "$TARGET_DIR"

# 1. Ensure tmux session exists with fixed directory and runs agy
if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
	tmux new-session -d -s "$SESSION_NAME" -c "$TARGET_DIR" "agy --dangerously-skip-permissions"
fi

# 2. Check if a window with our class already exists
WIN_ID="$(kdotool search --class "$APP_ID" 2>/dev/null | head -n 1 || true)"

if [ -z "$WIN_ID" ]; then
	# Spawn new terminal window attached to the tmux session
	exec kitty --class "$APP_ID" -e tmux attach-session -t "$SESSION_NAME"
else
	ACTIVE_WIN="$(kdotool getactivewindow 2>/dev/null || true)"
	if [ "$ACTIVE_WIN" = "$WIN_ID" ]; then
		# Already active, toggle off (minimize)
		kdotool windowminimize "$WIN_ID"
	else
		# Inactive or on another desktop / minimized:
		# Move window to current desktop, activate and raise to front
		kdotool set_desktop_for_window "$WIN_ID" current_desktop
		kdotool windowactivate "$WIN_ID"
		kdotool windowraise "$WIN_ID" 2>/dev/null || true
	fi
fi
