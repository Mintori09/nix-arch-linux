{ pkgs, ... }:

let
  rebuildPkg = pkgs.writeShellScriptBin "nix-rebuild" ''
    set -euo pipefail
    CONFIG_DIR="$HOME/.config/home-manager"

    ${pkgs.libnotify}/bin/notify-send -u low -t 3000 \
      -a "Home Manager" "⚙️ Rebuilding..." "Applying Home Manager configuration"

    echo -e "\e[34m==>\e[0m Rebuilding Home Manager configuration..."
    START_TIME=$(date +%s)

    # Đảm bảo các file mới được git nhận diện (tránh lỗi untracked của Nix Flakes)
    if [ -d "$CONFIG_DIR/.git" ]; then
      git -C "$CONFIG_DIR" add -N . 2>/dev/null || true
    fi

    if home-manager switch --flake "$CONFIG_DIR"; then
      ELAPSED=$(($(date +%s) - START_TIME))
      ${pkgs.libnotify}/bin/notify-send -u normal -t 4000 \
        -a "Home Manager" "✅ Rebuild Complete" "Switched to new generation in ''${ELAPSED}s"
      echo -e "\e[32m✔ Configuration applied successfully in ''${ELAPSED}s!\e[0m"
    else
      ${pkgs.libnotify}/bin/notify-send -u critical \
        -a "Home Manager" "❌ Rebuild Failed" "Check terminal output for errors"
      echo -e "\a\e[31m✖ Rebuild failed!\e[0m"
      exit 1
    fi
  '';
in
{
  home.packages = [ rebuildPkg ];

  xdg.desktopEntries.nix-rebuild = {
    name = "Nix Rebuild";
    genericName = "Apply Nix configuration";
    comment = "Switch to latest home-manager generation";
    icon = "system-software-update";
    exec = "ghostty --wait-after-command=true -e nix-rebuild";
    terminal = false;
    type = "Application";
    categories = [ "Utility" "Settings" ];
  };
}
