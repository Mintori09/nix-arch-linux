#!/bin/bash

# Remove the persistent udev rule
sudo rm -f /etc/udev/rules.d/10-disable-internal-keyboard.rules
sudo udevadm control --reload-rules

# The keyboard is already bound to atkbd ("Device or resource busy").
# Unbind and bind it again.
for d in /sys/bus/serio/devices/serio*; do
	if [[ -e "$d/driver" ]] && [[ "$(basename "$(readlink "$d/driver")")" == "atkbd" ]]; then
		dev=$(basename "$d")
		echo "Re-enabling $dev..."

		echo -n "$dev" | sudo tee /sys/bus/serio/drivers/atkbd/unbind >/dev/null
		sleep 0.2
		echo -n "$dev" | sudo tee /sys/bus/serio/drivers/atkbd/bind >/dev/null
	fi
done

echo "Keyboard enabled."
