{ lib, pkgs, ... }: {
  home.activation.updateDesktopDatabase = lib.hm.dag.entryAfter [ "linkGeneration" ] ''
    if [ -w "$HOME/.nix-profile/share/applications" ]; then
      ${pkgs.desktop-file-utils}/bin/update-desktop-database "$HOME/.nix-profile/share/applications"
    fi

    if [ -w "$HOME/.local/share/applications" ]; then
      ${pkgs.desktop-file-utils}/bin/update-desktop-database "$HOME/.local/share/applications"
    fi

    # Update icon cache and clean up dead symlinks in ~/.local/share/icons
    if [ -d "$HOME/.local/share/icons/hicolor" ]; then
      chmod -R u+w "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
      find "$HOME/.local/share/icons/hicolor" -xtype l -delete 2>/dev/null || true
      if command -v gtk-update-icon-cache >/dev/null 2>&1; then
        gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
      fi
    fi
  '';
}
