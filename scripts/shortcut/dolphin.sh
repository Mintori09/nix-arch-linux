#!/usr/bin/env bash
dolphin "$@" &
sleep 0.6
ydotool key 29:1 42:1 62:1 62:0 42:0 29:0
fcitx5-remote -o keyboard-us
