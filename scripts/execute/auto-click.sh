#!/usr/bin/env bash

set -e

COUNT=10
MIN_DELAY=3
MAX_DELAY=10

usage() {
    cat <<EOF
Usage: $0 [options]

Options:
  -n NUM    Number of clicks (default: 10)
  -m SEC    Minimum delay in seconds (default: 3)
  -M SEC    Maximum delay in seconds (default: 10)
  -h        Show this help

Examples:
  $0 -n 10
  $0 -n 20 -m 3 -M 10
  $0 -n 50 -m 5 -M 15
EOF
}

# No arguments -> show help
if [[ $# -eq 0 ]]; then
    usage
    exit 0
fi

while getopts "n:m:M:h" opt; do
    case "$opt" in
        n) COUNT="$OPTARG" ;;
        m) MIN_DELAY="$OPTARG" ;;
        M) MAX_DELAY="$OPTARG" ;;
        h)
            usage
            exit 0
            ;;
        *)
            usage
            exit 1
            ;;
    esac
done

if ((MIN_DELAY > MAX_DELAY)); then
    echo "Error: minimum delay cannot be greater than maximum delay."
    exit 1
fi

echo "Clicks: $COUNT"
echo "Delay:  ${MIN_DELAY}-${MAX_DELAY}s"
echo

for ((i = 1; i <= COUNT; i++)); do
    echo "[$i/$COUNT] Left click"

    ydotool click 0xC0

    if ((i < COUNT)); then
        delay=$((RANDOM % (MAX_DELAY - MIN_DELAY + 1) + MIN_DELAY))
        echo "         Waiting ${delay}s..."
        sleep "$delay"
    fi
done

echo
echo "Done."
