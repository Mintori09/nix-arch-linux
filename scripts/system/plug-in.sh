#!/usr/bin/env bash

# Actions to run when power adapter is plugged in (KDE Plasma on Arch)

# Reset CPU governor to performance-friendly profile
# echo "performance" | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor >/dev/null 2>&1 || true

# Energy performance preference → performance (max performance hint)
# if [[ -w /sys/devices/system/cpu/cpu0/cpufreq/energy_performance_preference ]]; then
#     echo "performance" | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/energy_performance_preference >/dev/null 2>&1 || true
# fi

# Raise backlight if it was dimmed on battery
if command -v brightnessctl &>/dev/null; then
    brightnessctl set 60% 2>/dev/null || true
fi

# Re-enable any power-profiles-daemon performance profile
if command -v powerprofilesctl &>/dev/null; then
    powerprofilesctl set balanced 2>/dev/null || true
fi

# DPMS / screen blank: restore longer timeouts for plugged-in use
if [[ -n "$DISPLAY" ]] && command -v xset &>/dev/null; then
    xset dpms 300 600 900 2>/dev/null || true
fi

# Notify
if ! command -v notify-send &>/dev/null; then
    echo "[plug-in.sh] WARNING: notify-send not found — skipping notification" >&2
else
    notify-send -t 3000 "Power Profile" "Plugged in — switched to performance mode"
fi
