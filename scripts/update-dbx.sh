#!/usr/bin/env bash
set -euo pipefail

DBX_NIX="$HOME/.config/home-manager/modules/packages/dbx.nix"

LATEST=$(curl -sL "https://api.github.com/repos/t8y2/dbx/releases/latest" | jq -r '.tag_name' | sed 's/^v//')
CURRENT=$(grep '^let version' "$DBX_NIX" | cut -d'"' -f2)

if [ "$LATEST" = "$CURRENT" ]; then
	echo "dbx is already at v$LATEST (current)"
	exit 0
fi

echo "Updating dbx: v$CURRENT → v$LATEST"

URL="https://github.com/t8y2/dbx/releases/download/v${LATEST}/DBX_${LATEST}_amd64.deb"
TMP_DEB=$(mktemp)
trap 'rm -f $TMP_DEB' EXIT

curl -sL -o "$TMP_DEB" "$URL"
HASH=$(nix hash file "$TMP_DEB" --sri)

# -- update version
sed -i "s/^let version = \".*\";/let version = \"$LATEST\";/" "$DBX_NIX"

# -- update hash
sed -i "s|hash = \"sha256-.*\";|hash = \"$HASH\";|" "$DBX_NIX"

echo "Updated $DBX_NIX"
echo "hash = $HASH"
echo ""
echo "Run: home-manager switch --flake ~/.config/home-manager"
