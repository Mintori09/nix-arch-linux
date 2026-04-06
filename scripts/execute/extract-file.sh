#!/usr/bin/env bash

# Script created on Wed  3 Dec 01:20:20 +07 2025

if [ $# -eq 0 ]; then
    echo "Usage: $(basename "$0") <file1> [file2 ...]"
    exit 1
fi

for file in "$@"; do
    if [ -f "$file" ]; then
        echo "Extracting '$file'..."
        case "$file" in
            *.tar.bz2) tar xvjf "$file" ;;
            *.tar.gz) tar xvzf "$file" ;;
            *.tar.xz) tar xJf "$file" ;;
            *.tbz2) tar xvjf "$file" ;;
            *.tgz) tar xvzf "$file" ;;
            *.tar) tar xvf "$file" ;;
            *.bz2) bunzip2 "$file" ;;
            *.gz) gunzip "$file" ;;
            *.zip) unzip "$file" ;;
            *.7z) 7z x "$file" ;;
            *.rar) unrar x "$file" ;;
            *.Z) uncompress "$file" ;;
            *.rpm) bsdtar -xvf "$file" ;;
            *.epub) unzip "$file" ;;
            *.deb) ar x "$file" ;;
            *) echo "> '$file' cannot be extracted via this script" ;;
        esac
    else
        echo "> '$file' is not a valid file!"
    fi
done
