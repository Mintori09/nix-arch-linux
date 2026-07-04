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

# ── Step 0: Detect OS & Install Dependencies ──────────────────────────────
# Check if running on NixOS
if [ -f /etc/NIXOS ]; then
	info "Running on NixOS. Nix is already installed, skipping Nix daemon setup."
	IS_NIXOS=true
else
	IS_NIXOS=false
fi

# Ensure git is installed
if ! command -v git &>/dev/null; then
	warn "Git is not installed."
	if [ -f /etc/arch-release ]; then
		if prompt "Detected Arch Linux. Install git using pacman?"; then
			sudo pacman -S --needed --noconfirm git
		else
			warn "Cannot continue without git."
			exit 1
		fi
	else
		warn "Please install git first, then run this script again."
		exit 1
	fi
fi

# ── Step 1: Install Nix if missing (Non-NixOS only) ───────────────────────
if [ "$IS_NIXOS" = false ]; then
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
fi

# ── Step 2: Enable flakes (Non-NixOS only) ────────────────────────────────
if [ "$IS_NIXOS" = false ]; then
	NIX_CONF="/etc/nix/nix.conf"
	# Ensure the directory exists
	sudo mkdir -p "$(dirname "$NIX_CONF")"
	if [ ! -f "$NIX_CONF" ] || ! grep -q "experimental-features" "$NIX_CONF" 2>/dev/null; then
		info "Enabling flakes in $NIX_CONF (requires sudo)."
		echo "experimental-features = nix-command flakes" | sudo tee -a "$NIX_CONF" >/dev/null
	else
		info "Flakes already enabled."
	fi

	# Add trusted users to allow binary cache usage
	if [ -f "$NIX_CONF" ] && ! grep -q "trusted-users" "$NIX_CONF" 2>/dev/null; then
		info "Adding current user & groups to trusted-users in $NIX_CONF (requires sudo)."
		echo "trusted-users = root @wheel @sudors @nix-users $(whoami)" | sudo tee -a "$NIX_CONF" >/dev/null
	fi
fi

if [ -f /etc/profile.d/nix.sh ]; then
	. /etc/profile.d/nix.sh
fi

# ── Step 3: Restart daemon to pick up config (Non-NixOS only) ─────────────
if [ "$IS_NIXOS" = false ]; then
	info "Restarting nix-daemon to apply flakes config."
	sudo systemctl restart nix-daemon 2>/dev/null || true
	sleep 1
fi

# ── Step 4: Clone or update config repo ───────────────────────────────────
if [ -d "$CONFIG_DIR/.git" ]; then
	info "Config repo exists at $CONFIG_DIR — pulling latest."
	git -C "$CONFIG_DIR" pull --ff-only
else
	# Backup existing directory if it's not a git repository
	if [ -d "$CONFIG_DIR" ]; then
		warn "$CONFIG_DIR exists but is not a git repo. Backing up to ${CONFIG_DIR}.bak"
		rm -rf "${CONFIG_DIR}.bak"
		mv "$CONFIG_DIR" "${CONFIG_DIR}.bak"
	fi

	info "Cloning config repo to $CONFIG_DIR."
	# Try SSH clone first, fallback to HTTPS
	if git clone "$REPO_SSH" "$CONFIG_DIR" 2>/dev/null; then
		info "Cloned via SSH."
	else
		warn "SSH clone failed — trying HTTPS."
		git clone "$REPO_HTTPS" "$CONFIG_DIR"
		info "Cloned via HTTPS."
	fi
fi

# ── Step 4.5: Auto-patch username if different ────────────────────────────
CURRENT_USER=$(whoami)
if [ "$CURRENT_USER" != "mintori" ]; then
	info "Current user ($CURRENT_USER) differs from default config user (mintori). Auto-patching configurations..."
	info "Patching username in flake.nix..."
	sed -i "s/username = \"mintori\";/username = \"$CURRENT_USER\";/g" "$CONFIG_DIR/flake.nix"

	info "Patching username & homeDirectory in home.nix..."
	sed -i "s/home.username = \"mintori\";/home.username = \"$CURRENT_USER\";/g" "$CONFIG_DIR/home.nix"
	sed -i "s|home.homeDirectory = \"/home/mintori\";|home.homeDirectory = \"$HOME\";|g" "$CONFIG_DIR/home.nix"

	FLAKE_ATTR="homeManagerConfigurations.$CURRENT_USER.activationPackage"
	info "Updated build target to: $FLAKE_ATTR"
fi

# ── Step 5: Initialize template files ─────────────────────────────────────
# Create template secrets.json if missing to prevent build errors
if [ ! -f "$CONFIG_DIR/secrets.json" ]; then
	info "Creating template secrets.json..."
	echo "{}" >"$CONFIG_DIR/secrets.json"
fi

# ── Step 6: Build and activate ────────────────────────────────────────────
if prompt "Build and activate home-manager configuration?"; then
	info "Building activation package from flake..."
	nix build "$CONFIG_DIR#$FLAKE_ATTR" \
		--extra-substituters "https://cache.garnix.io" \
		--extra-trusted-public-keys "cache.garnix.io:6Qx5mNISvUAGPkH2FvPNhp7YZnRqnEL79E6G/6ZPkRc="

	info "Activating configuration..."
	"$CONFIG_DIR/result/activate"

	info "Cleaning up build result symlink."
	rm -f "$CONFIG_DIR/result"

	# Auto-allow direnv if installed
	if command -v direnv &>/dev/null; then
		info "Authorizing direnv for the configuration directory..."
		(cd "$CONFIG_DIR" && direnv allow)
	fi

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
