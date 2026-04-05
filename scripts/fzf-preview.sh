#!/usr/bin/env bash

# Sử dụng XDG_CACHE_HOME nếu có, nếu không dùng ~/.cache hoặc /tmp
PREVIEW_CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/fzf-preview"
mkdir -p "$PREVIEW_CACHE"

[[ $# -ne 1 ]] && {
	echo "usage: $0 FILENAME[:LINENO][:IGNORED]" >&2
	exit 1
}

file="${1/#\~\//$HOME}"
center=0

if [[ ! -r "$file" ]]; then
	if [[ "$file" =~ ^(.+):([0-9]+) ]]; then
		candidate="${BASH_REMATCH[1]}"
		if [[ -r "$candidate" ]]; then
			file="$candidate"
			center="${BASH_REMATCH[2]}"
		fi
	fi
fi

readonly TERM_WIDTH=${FZF_PREVIEW_COLUMNS:-$(tput cols 2>/dev/null || echo 80)}
readonly TERM_HEIGHT=${FZF_PREVIEW_LINES:-$(tput lines 2>/dev/null || echo 24)}
dim="${TERM_WIDTH}x${TERM_HEIGHT}"

type=$(file --brief --dereference --mime-type -- "$file")

get_cache_path() {
	local target="$1"
	local ext="$2"
	echo "$PREVIEW_CACHE/$(echo -n "$target" | cksum | cut -f1 -d' ')$ext"
}

render_image() {
	local target="$1"
	# 1. Kitty / Ghostty
	if [[ -n "$KITTY_WINDOW_ID" || -n "$GHOSTTY_RESOURCES_DIR" ]] && command -v kitten >/dev/null; then
		kitten icat --clear --transfer-mode=memory --unicode-placeholder --stdin=no --place="$dim@0x0" "$target"
		printf "\e[m"
		return
	fi
	# 2. Wezterm
	if [[ "$TERM_PROGRAM" == "WezTerm" ]] && command -v wezterm >/dev/null; then
		wezterm imgcat "$target"
		printf "\e[m"
		return
	fi
	# 3. Chafa (fallback cho mọi terminal)
	if command -v chafa >/dev/null; then
		chafa -s "$dim" "$target"
		printf "\e[m"
	else
		file --brief -- "$target"
	fi
}

case "$type" in
inode/directory)
	if command -v eza >/dev/null; then
		eza --long --tree --level=2 --icons --color=always "$file"
	else
		tree -L 2 -C "$file"
	fi
	;;

image/svg+xml)
	cache_file=$(get_cache_path "$file" ".png")
	if [[ ! -f "$cache_file" ]] && command -v rsvg-convert >/dev/null; then
		rsvg-convert "$file" -o "$cache_file"
	fi
	[[ -f "$cache_file" ]] && render_image "$cache_file" || bat --color=always "$file"
	;;

image/*)
	render_image "$file"
	;;

application/pdf)
	cache_file=$(get_cache_path "$file" ".jpg")
	if [[ ! -f "$cache_file" ]]; then
		if command -v pdftoppm >/dev/null; then
			pdftoppm -f 1 -l 1 -jpeg -singlefile "$file" "${cache_file%.jpg}"
		else
			echo "Install poppler/pdftoppm to preview PDFs" && exit 0
		fi
	fi
	render_image "$cache_file"
	;;

video/*)
	cache_file=$(get_cache_path "$file" ".jpg")
	if [[ ! -f "$cache_file" ]]; then
		if command -v ffmpegthumbnailer >/dev/null; then
			ffmpegthumbnailer -i "$file" -o "$cache_file" -s 0 -q 5 2>/dev/null
		else
			ffmpeg -y -i "$file" -ss 00:00:02 -vframes 1 -an -q:v 5 "$cache_file" >/dev/null 2>&1
		fi
	fi
	[[ -f "$cache_file" ]] && render_image "$cache_file" || file --brief -- "$file"
	;;

application/json)
	if command -v jq >/dev/null; then
		jq -C . "$file" | head -n 100
	else
		bat --language=json --color=always "$file"
	fi
	;;

text/markdown)
	if command -v glow >/dev/null; then
		glow -s dark "$file"
	elif command -v mdcat >/dev/null; then
		mdcat "$file"
	else
		bat --language=markdown --color=always "$file"
	fi
	;;

text/csv)
	if command -v column >/dev/null; then
		column -s, -t <"$file" | head -n "$TERM_HEIGHT" | bat --language=csv --color=always
	else
		bat --color=always "$file"
	fi
	;;

application/zip | application/x-tar | application/x-7z-compressed | application/x-rar | application/x-gzip | application/x-bzip2 | application/x-xz)
	if command -v atool >/dev/null; then
		atool --list "$file" | bat --language=help --color=always
	elif command -v bsdtar >/dev/null; then
		bsdtar --list --file "$file" | bat --language=help --color=always
	else
		file --brief -- "$file"
	fi
	;;

application/epub+zip)
	cache_file=$(get_cache_path "$file" ".jpg")
	if [[ ! -f "$cache_file" ]]; then
		cover_path=$(unzip -l "$file" 2>/dev/null | grep -iE 'cover\.(jpg|jpeg|png)' | head -n1 | awk '{print $NF}')
		[[ -n "$cover_path" ]] && unzip -p "$file" "$cover_path" >"$cache_file" 2>/dev/null
	fi
	if [[ -f "$cache_file" && -s "$cache_file" ]]; then
		render_image "$cache_file"
	else
		unzip -l "$file" | head -n "$TERM_HEIGHT"
	fi
	;;

*)
	if [[ "$type" == *binary* ]]; then
		if command -v hexyl >/dev/null; then
			hexyl --border none --length 1024 "$file"
		else
			file --brief -- "$file"
		fi
	else
		BAT_CMD=$(command -v bat || command -v batcat)
		if [[ -n "$BAT_CMD" ]]; then
			start_line=0
			if ((center > TERM_HEIGHT / 2)); then
				start_line=$((center - TERM_HEIGHT / 2))
			fi
			"$BAT_CMD" --style="${BAT_STYLE:-numbers,changes}" --color=always --pager=never \
				--highlight-line="$center" --line-range "$start_line:" -- "$file"
		else
			cat "$file"
		fi
	fi
	;;
esac
