#!/bin/bash

# Script created on Wed  3 Dec 01:18:16 +07 2025
find-and-open-video() {
    local file
    file=$(fd -t f -e mp4 -e mkv -e avi -e mov -e webm -e flv |
        sort -V |
        fzf --style full --prompt="🎬 Select a video: ")

    kitten icat --clear 2>/dev/null

    if [[ -n "$file" ]]; then
        xdg-open "$file" &>/dev/null &
    else
        echo "No video selected."
    fi
}
find-and-open-video
