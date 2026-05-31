#!/usr/bin/env bash
set -euo pipefail

REPO_SSH="git@github.com:Mintori09/nix-arch-linux.git"
REPO_HTTPS="https://github.com/Mintori09/nix-arch-linux.git"
CONFIG_DIR="$HOME/.config/home-manager"
FLAKE_ATTR="homeManagerConfigurations.mintori.activationPackage"

info() { printf "\n  [INFO] %s\n" "$1"; }
warn() { printf "\n  [WARN] %s\n" "$1"; }
prompt() {
	printf "\n  [INPUT] %s [y/N] " "$1"
	read -r reply
	case "$reply" in [yY] | [yY][eE][sS]) return 0 ;; *) return 1 ;; esac
}

# ── Step 1: Install Nix if missing ──────────────────────────────────────
if command -v nix &>/dev/null; then
	info "Nix already installed, skipping."
else
	info "Nix not found — installing multi-user daemon (requires sudo)."
	if prompt "Proceed with Nix daemon installation?"; then
		sh <(curl --proto '=https' --tlsv1.2 -L https://nixos.org/nix/install) --daemon --no-channel-add
	else
		warn "Nix install skipped. Cannot continue without Nix."
		exit 1
	fi
	if [ -f /etc/profile.d/nix.sh ]; then
		. /etc/profile.d/nix.sh
	fi
fi

# ── Step 2: Enable flakes ───────────────────────────────────────────────
NIX_CONF="/etc/nix/nix.conf"
if ! grep -q "experimental-features" "$NIX_CONF" 2>/dev/null; then
	info "Enabling flakes in $NIX_CONF (requires sudo)."
	echo "experimental-features = nix-command flakes" | sudo tee -a "$NIX_CONF" >/dev/null
else
	info "Flakes already enabled."
fi

if [ -f /etc/profile.d/nix.sh ]; then
	. /etc/profile.d/nix.sh
fi

# ── Step 3: Restart daemon to pick up config ────────────────────────────
info "Restarting nix-daemon to apply flakes config."
sudo systemctl restart nix-daemon 2>/dev/null || true
sleep 1

# ── Step 4: Clone or update config repo ────────────────────────────────
if [ -d "$CONFIG_DIR/.git" ]; then
	info "Config repo exists at $CONFIG_DIR — pulling latest."
	git -C "$CONFIG_DIR" pull --ff-only
else
	info "Cloning config repo to $CONFIG_DIR."
	if git clone "$REPO_SSH" "$CONFIG_DIR" 2>/dev/null; then
		info "Cloned via SSH."
	else
		warn "SSH clone failed — trying HTTPS."
		git clone "$REPO_HTTPS" "$CONFIG_DIR"
		info "Cloned via HTTPS."
	fi
fi

# ── Step 5: Build and activate ─────────────────────────────────────────
if prompt "Build and activate home-manager configuration?"; then
	info "Building activation package from flake..."
	nix build "$CONFIG_DIR#$FLAKE_ATTR" \
		--extra-trusted-public-keys "cache.garnix.io:6Qx5mNISvUAGPkH2FvPNhp7YZnRqnEL79E6G/6ZPkRc="

	info "Activating configuration..."
	"$CONFIG_DIR/result/activate"

	info "Cleaning up build result symlink."
	rm -f "$CONFIG_DIR/result"

	info "Bootstrap complete!"
	echo ""
	echo "  ── Post-install reminders ──"
	echo "  1. Place secrets: $CONFIG_DIR/secrets.json"
	echo "  2. Restart shell or: source /etc/profile.d/nix.sh"
	echo "  3. Systemd user services: systemctl --user daemon-reload"
	echo "  4. Test: hms (should run without errors)"
	echo "  5. GPU apps: nixGL <program>"
	echo ""
else
	warn "Activation skipped. Run later:"
	echo "  cd ~/.config/home-manager"
	echo "  nix build .#$FLAKE_ATTR && ./result/activate && rm result"
fi
