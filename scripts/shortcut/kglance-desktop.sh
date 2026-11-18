#!/usr/bin/env bash

set -euo pipefail

DEPENDENCIES=("ydotool" "wl-paste" "kglance")

cleanup() {
	ydotool key 29:0 &>/dev/null || true
}
trap cleanup EXIT INT TERM

check_dependencies() {
	for cmd in "${DEPENDENCIES[@]}"; do
		if ! command -v "$cmd" &>/dev/null; then
			echo "Error: Required command '$cmd' is not installed or not in PATH." >&2
			exit 1
		fi
	done
}

get_clipboard_files() {
	local clip_data
	clip_data=$(wl-paste --type text/uri-list 2>/dev/null || wl-paste --type text/plain 2>/dev/null || true)

	if [[ -z $clip_data ]]; then
		return 1
	fi

	local -a valid_paths=()
	while IFS= read -r line; do
		line=$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 'r')
		[[ -z $line ]] && continue

		if [[ $line =~ ^file:// ]]; then
			line=$(python3 -c "import sys, urllib.parse; print(urllib.parse.unquote(sys.argv[1][7:]))" "$line" 2>/dev/null || echo "${line#file://}")
		fi

		if [[ -e $line ]]; then
			valid_paths+=("$line")
		fi
	done <<<"$clip_data"

	if [[ ${#valid_paths[@]} -eq 0 ]]; then
		return 1
	fi

	echo "${valid_paths[@]}"
}

main() {
	check_dependencies

	local active_class
	active_class="$(kdotool getactivewindow getwindowclassname 2>/dev/null || true)"
	if [[ "$active_class" != "kitty" && "$active_class" != "Alacritty" ]]; then
		ydotool key 29:1
		sleep 0.05
		ydotool key 46:1
		sleep 0.05
		ydotool key 46:0
		sleep 0.05
		ydotool key 29:0
		sleep 0.15
	fi

	local paths_str
	if ! paths_str=$(get_clipboard_files); then
		echo "Error: No valid file paths found in clipboard." >&2
		exit 1
	fi

	read -r -a file_paths <<<"$paths_str"

	cleanup
	exec kglance "${file_paths[@]}"
}

main "$@"
