#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$HOME/.config/home-manager"
CONFIG_FILE="$REPO_DIR/nvfetcher.toml"
SOURCES_DIR="$REPO_DIR/modules/packages/_sources"

TARGET="${1:-all}"

echo "Checking and updating packages via nvfetcher..."

cd "$REPO_DIR"

if [ "$TARGET" = "all" ]; then
    nvfetcher -c "$CONFIG_FILE" -o "$SOURCES_DIR"
else
    nvfetcher -c "$CONFIG_FILE" -o "$SOURCES_DIR" -f "$TARGET"
fi

if ! git diff --quiet -- "$SOURCES_DIR"; then
    echo "Changes detected in sources. Preparing commit..."
    git add "$SOURCES_DIR"
    git commit -m "chore(packages): update nvfetcher generated sources"
    echo "Committed successfully!"
else
    echo "✅ All packages are already up to date!"
fi
