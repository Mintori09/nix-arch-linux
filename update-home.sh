#!/usr/bin/env bash
set -euo pipefail

GITHUB_TOKEN=$(gh auth token 2>/dev/null || true)
if [ -n "$GITHUB_TOKEN" ]; then
	export NIX_CONFIG="access-tokens = github.com=$GITHUB_TOKEN"
fi

echo "  [INFO] Updating flake inputs..."
nix flake update

echo "  [INFO] Applying home-manager configuration..."
home-manager switch --flake "$HOME/.config/home-manager" -j 1

echo "  [INFO] Update complete!"
