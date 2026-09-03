#!/bin/bash

set -e

KEYBOARD_NAME="AT Translated Set 2 keyboard"
RULE_FILE="/etc/udev/rules.d/10-disable-internal-keyboard.rules"

if [[ $EUID -ne 0 ]]; then
	exec sudo bash "$0" "$@"
fi

echo "Looking for: $KEYBOARD_NAME"

# Find the input event device by reading sysfs directly.
EVENT=""
for dev in /sys/class/input/event*/device/name; do
	[[ -f "$dev" ]] || continue

	NAME=$(cat "$dev")

	if [[ "$NAME" == "$KEYBOARD_NAME" ]]; then
		EVENT="/dev/input/${dev#/sys/class/input/}"
		EVENT="${EVENT%/device/name}"
		EVENT="${EVENT#/dev/input/}"
		EVENT="/dev/input/$EVENT"
		break
	fi
done

if [[ -z "$EVENT" ]]; then
	echo "Could not find internal keyboard."
	echo
	echo "Available keyboards:"
	for dev in /sys/class/input/event*/device/name; do
		[[ -f "$dev" ]] || continue
		NAME=$(cat "$dev")
		[[ "$NAME" == *keyboard* || "$NAME" == *Keyboard* ]] &&
			echo "  $(basename "$(dirname "$dev")"): $NAME"
	done
	exit 1
fi

EVENT_NAME=$(basename "$EVENT")

echo "Found: $EVENT"
echo

# Create the persistent udev rule.
cat >"$RULE_FILE" <<EOF
ACTION=="add|change", KERNEL=="event*", ATTRS{name}=="$KEYBOARD_NAME", ENV{LIBINPUT_IGNORE_DEVICE}="1"
EOF

udevadm control --reload-rules

echo "Udev rule installed: $RULE_FILE"

# Find the serio device responsible for the AT keyboard.
SYSFS_DEVICE=$(udevadm info --query=path --name="$EVENT")

echo "Sysfs path: $SYSFS_DEVICE"

SERIO=""

# Walk up the sysfs path looking for serioX.
CURRENT="$SYSFS_DEVICE"

while [[ "$CURRENT" != "/" && -n "$CURRENT" ]]; do
	BASENAME=$(basename "$CURRENT")

	if [[ "$BASENAME" =~ ^serio[0-9]+$ ]]; then
		SERIO="$BASENAME"
		break
	fi

	CURRENT=$(dirname "$CURRENT")
done

if [[ -z "$SERIO" ]]; then
	echo "Could not find the AT keyboard's serio device."
	echo
	echo "Sysfs path was:"
	echo "$SYSFS_DEVICE"
	exit 1
fi

echo "Found AT keyboard controller: $SERIO"

# Immediately unbind the AT keyboard driver.
# This disables the keyboard NOW, without rebooting or logging out.
if [[ -e "/sys/bus/serio/drivers/atkbd/unbind" ]]; then
	echo -n "$SERIO" >/sys/bus/serio/drivers/atkbd/unbind
	echo "Internal keyboard disabled immediately."
else
	echo "ERROR: atkbd driver does not expose an unbind interface."
	exit 1
fi

echo
echo "Done."
echo "Persistent udev rule: $RULE_FILE"
echo "Current keyboard: DISABLED"
echo
echo "To re-enable it temporarily:"
echo "  echo -n $SERIO > /sys/bus/serio/drivers/atkbd/bind"
