#!/bin/bash

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}"

kfocus() {
	local class="$1"

	if [[ -z $class ]]; then
		echo "Usage: kfocus <window-class>"
		return 1
	fi

	local wid
	wid=$(kdotool search --class "$class" 2>/dev/null | head -n1)

	if [[ -n $wid ]]; then
		kdotool windowactivate "$wid"
	else
		echo "No window found with class: $class"
		return 1
	fi
}

move_app_to_desktop() {
	local target_desktop="$1"
	local class_pattern="$2"
	shift 2
	local cmd=("$@")

	"${cmd[@]}" &

	local win_id=""
	for i in {1..30}; do
		sleep 0.5
		win_id=$(kdotool search --class "$class_pattern" 2>/dev/null | tail -n 1)
		if [ -n "$win_id" ]; then
			kdotool set_desktop_for_window "$win_id" "$target_desktop"
			break
		fi
	done
}

move_app_to_desktop 1 "firefox" firefox

# move_app_to_desktop 2 "kitty" kitty --session "$CONFIG_DIR/kitty/startup_session.conf"

# move_app_to_desktop 3 "spotify" spotify
