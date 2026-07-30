#!/usr/bin/env bash
set -euo pipefail

ZAP_NIX="$HOME/.config/home-manager/modules/packages/zap.nix"

LATEST=$(curl -sL "https://api.github.com/repos/zerx-lab/zap/releases/latest" | jq -r '.tag_name' | sed 's/^v//')
CURRENT=$(grep 'version = "' "$ZAP_NIX" | cut -d'"' -f2)

if [ "$LATEST" = "$CURRENT" ]; then
    echo "zap is already at v$LATEST (current)"
    exit 0
fi

echo "Updating zap: v$CURRENT → v$LATEST"

URL="https://github.com/zerx-lab/zap/releases/download/v${LATEST}/zap_${LATEST}_amd64.deb"
TMP_DEB=$(mktemp)
trap 'rm -f $TMP_DEB' EXIT

curl -sL -o "$TMP_DEB" "$URL"
HASH=$(nix hash file "$TMP_DEB" --sri)

# -- update version
sed -i "s/version = \".*\";/version = \"$LATEST\";/" "$ZAP_NIX"

# -- update hash
sed -i "s|hash = \"sha256-.*\";|hash = \"$HASH\";|" "$ZAP_NIX"

echo "Updated $ZAP_NIX"
echo "hash = $HASH"
echo ""
echo "Run: home-manager switch --flake ~/.config/home-manager"
