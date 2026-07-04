#!/usr/bin/env bash
# Remove all subtitle files in the current directory
shopt -s nocaseglob
rm -f *.{srt,vtt,ass,ssa,sub} 2>/dev/null
shopt -u nocaseglob

OUTPUT_DIR=$HOME/"Documents/[2] Obsidian/00_Index"
OUTPUT_FILE="$OUTPUT_DIR/video_thumbnails.md"
THUMB_DIR="$OUTPUT_DIR/thumbnails"

mkdir -p "$THUMB_DIR"

declare -A current_videos
shopt -s nocaseglob
for video in *.{mp4,mkv,avi,mov,flv,wmv}; do
	if [ -e "$video" ]; then
		filename=$(basename -- "$video")
		filename_no_ext="${filename%.*}"
		current_videos["$filename_no_ext"]=1
	fi
done
shopt -u nocaseglob

if [ -d "$THUMB_DIR" ]; then
	for thumb in "$THUMB_DIR"/*.jpg; do
		[ -e "$thumb" ] || continue
		thumb_name=$(basename -- "$thumb")
		thumb_no_ext="${thumb_name%.*}"

		if [ -z "${current_videos[$thumb_no_ext]}" ]; then
			echo "Deleting orphaned thumbnail: $thumb_name"
			rm "$thumb"
		fi
	done
fi

cat <<'EOF' >"$OUTPUT_FILE"
---
cssclasses:
  - full-page
  - academia
tags:
  - moc
---
| Video Name | Duration | Thumbnail | Absolute Path |
| :--- | :---: | :---: | :--- |
EOF

shopt -s nocaseglob
for video in *.{mp4,mkv,avi,mov,flv,wmv}; do
	[ -e "$video" ] || continue
	filename=$(basename -- "$video")
	filename_no_ext="${filename%.*}"
	thumb_path_real="$THUMB_DIR/${filename_no_ext}.jpg"
	thumb_path_md="thumbnails/${filename_no_ext}.jpg"
	abs_path=$(realpath "$video")

	duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 -sexagesimal "$video" 2>/dev/null | cut -d'.' -f1)
	if [ -z "$duration" ]; then
		duration="N/A"
	else
		if [[ $duration =~ ^([0-9]):([0-9]{2}):([0-9]{2})$ ]]; then
			duration="0${BASH_REMATCH[1]}:${BASH_REMATCH[2]}:${BASH_REMATCH[3]}"
		fi
		if [[ $duration == 00:* ]]; then
			duration="${duration#00:}"
		fi
	fi

	if [ -f "$thumb_path_real" ]; then
		echo "Using cached thumbnail for: $video"
	else
		echo "Processing: $video..."
		ffmpeg -y -nostdin -ss 00:00:02 -i "$video" -vframes 1 -vf "scale=160:-1" -v quiet "$thumb_path_real"
		if [ ! -f "$thumb_path_real" ]; then
			ffmpeg -y -nostdin -i "$video" -vframes 1 -vf "scale=160:-1" -v quiet "$thumb_path_real"
		fi
	fi
	echo "| $filename | $duration | <img src=\"$thumb_path_md\" width=\"120\"> | [Open Video](<file://$abs_path>) |" >>"$OUTPUT_FILE"
done
shopt -u nocaseglob

echo "Done! Generated output in: $OUTPUT_DIR"
