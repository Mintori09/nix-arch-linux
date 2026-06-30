{ lib, pkgs, ... }: {
  home.activation.updateDesktopDatabase = lib.hm.dag.entryAfter [ "linkGeneration" ] ''
    if [ -w "$HOME/.nix-profile/share/applications" ]; then
      ${pkgs.desktop-file-utils}/bin/update-desktop-database "$HOME/.nix-profile/share/applications"
    fi

    if [ -w "$HOME/.local/share/applications" ]; then
      ${pkgs.desktop-file-utils}/bin/update-desktop-database "$HOME/.local/share/applications"
    fi
  '';
}
