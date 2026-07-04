#!/usr/bin/env bash

# Actions to run when power adapter is unplugged — battery save mode (KDE Plasma on Arch Linux laptop)

# 1. CPU governor → powersave
# echo "powersave" | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor >/dev/null 2>&1 || true

# 2. Energy performance preference → power (most battery-saving hint)
# if [[ -w /sys/devices/system/cpu/cpu0/cpufreq/energy_performance_preference ]]; then
#     echo "power" | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/energy_performance_preference >/dev/null 2>&1 || true
# fi

# 3. Power-profiles-daemon → power-saver
if command -v powerprofilesctl &>/dev/null; then
	powerprofilesctl set power-saver 2>/dev/null || true
fi

# 4. Dim the display to conserve battery
if command -v brightnessctl &>/dev/null; then
	brightnessctl set 40% 2>/dev/null || true
fi

# Set monitor refresh rate to 60Hz on battery
if command -v kscreen-doctor &>/dev/null; then
	kscreen-doctor output.eDP-1.mode.1920x1080@60 2>/dev/null || true
fi

# 5. DPMS / screen blank: suspend after 2 min, switch off after 3 min
if [[ -n $DISPLAY ]] && command -v xset &>/dev/null; then
	xset dpms 120 180 300 2>/dev/null || true
fi

# 6. Notify
if command -v notify-send &>/dev/null; then
	notify-send -t 3000 "Power Profile" "Unplugged — switched to power-save mode"
else
	echo "[plug-out.sh] WARNING: notify-send not found — skipping notification" >&2
fi
