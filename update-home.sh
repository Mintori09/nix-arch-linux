#!/usr/bin/env bash
set -euo pipefail

echo "  [INFO] Updating flake inputs..."
nix flake update

echo "  [INFO] Applying home-manager configuration..."
home-manager switch --flake "$HOME/.config/home-manager" -j 1

echo "  [INFO] Update complete!"
