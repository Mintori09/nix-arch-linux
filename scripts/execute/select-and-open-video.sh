#!/bin/bash

# Script created on Wed  3 Dec 01:18:16 +07 2025

show_help() {
	echo "Usage: $(basename "$0") [options]"
	echo ""
	echo "Options:"
	echo "  -r    Search recursively (include subdirectories)"
	echo "  -h    Show this help message"
	echo ""
	echo "By default, the script only searches for videos in the current directory."
}

find-and-open-video() {
	local recursive=false

	# Parse arguments
	while getopts "rh" opt; do
		case $opt in
			r) recursive=true ;;
			h)
				show_help
				return 0
				;;
			*)
				show_help
				return 1
				;;
		esac
	done

	local fd_opts=()
	fd_opts+=(-t f -e mp4 -e mkv -e avi -e mov -e webm -e flv)

	if [[ "$recursive" == false ]]; then
		fd_opts+=(--max-depth 1)
	fi

	local file
	file=$(fd "${fd_opts[@]}" |
		sort -V |
		fzf --style full --prompt="🎬 Select a video: ")

	kitten icat --clear 2>/dev/null

	if [[ -n "$file" ]]; then
		xdg-open "$file" &>/dev/null &
	else
		echo "No video selected."
	fi
}

find-and-open-video "$@"
