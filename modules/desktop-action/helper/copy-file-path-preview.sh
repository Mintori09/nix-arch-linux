#!/usr/bin/env bash

# Only simulate Ctrl+C if active window is not a terminal emulator
ACTIVE_CLASS="$(kdotool getactivewindow getwindowclassname 2>/dev/null || true)"
if [[ "$ACTIVE_CLASS" != "kitty" && "$ACTIVE_CLASS" != "Alacritty" ]]; then
	# Simulate Ctrl+C using ydotool (key 29 is KEY_LEFTCTRL, 46 is KEY_C)
	ydotool key 29:1 46:1 46:0 29:0
	sleep 0.1
fi

# Get copied filepath / URI from clipboard
if command -v wl-paste >/dev/null 2>&1; then
	# Try text/uri-list first if copied from file managers, fallback to standard text
	CLIP="$(wl-paste -t text/uri-list 2>/dev/null || wl-paste --no-newline 2>/dev/null)"
else
	CLIP="$(xclip -selection clipboard -o 2>/dev/null || xsel --clipboard --output 2>/dev/null)"
fi

# Extract first file path if multiple lines or URI format
FILEPATH="$(printf '%s\n' "$CLIP" | sed -e 's|^file://||' -e 's|\r$||' | head -n 1)"

# URL-decode filepath if needed
if [[ "$FILEPATH" == *%* ]]; then
	FILEPATH="$(printf '%b' "${FILEPATH//%/\\x}")"
fi

# Open with kglance
kglance "$FILEPATH"
