{ lib, pkgs, ... }:
let
  wrappedPkgs = import ./wrappers.nix { inherit pkgs; };
in
{
  xdg.desktopEntries = {
    obsidian = {
      name = "Obsidian";
      genericName = "Knowledge Base";
      comment = "Markdown knowledge base";
      exec = "${wrappedPkgs.obsidian}/bin/obsidian";
      terminal = false;
      categories = [
        "Office"
        "Utility"
      ];
      icon = "obsidian";
      startupNotify = true;
    };

    gimp = {
      name = "GIMP";
      genericName = "Image Editor";
      comment = "Create images and edit photographs";
      exec = "${wrappedPkgs.gimp}/bin/gimp";
      terminal = false;
      categories = [
        "Graphics"
        "2DGraphics"
        "RasterGraphics"
      ];
      icon = "gimp";
      startupNotify = true;
    };

    foliate = {
      name = "Foliate";
      genericName = "E-book Reader";
      comment = "Read EPUB books";
      exec = "${wrappedPkgs.foliate}/bin/foliate";
      terminal = false;
      categories = [
        "Office"
        "Viewer"
      ];
      icon = "foliate";
      startupNotify = true;
    };

    drawio = {
      name = "Draw.io";
      genericName = "Diagram Editor";
      comment = "Create diagrams and flowcharts";
      exec = "${wrappedPkgs.drawio}/bin/drawio";
      terminal = false;
      categories = [
        "Graphics"
        "Office"
      ];
      icon = "drawio";
      startupNotify = true;
    };

    localsend = {
      name = "LocalSend";
      genericName = "File Sharing";
      comment = "Share files across devices";
      exec = "${wrappedPkgs.localsend}/bin/localsend_app";
      terminal = false;
      categories = [
        "Network"
        "FileTransfer"
        "Utility"
      ];
      icon = "localsend";
      startupNotify = true;
    };
  };

  home.activation.updateDesktopDatabase = lib.hm.dag.entryAfter [ "linkGeneration" ] ''
    if [ -w "$HOME/.nix-profile/share/applications" ]; then
      ${pkgs.desktop-file-utils}/bin/update-desktop-database "$HOME/.nix-profile/share/applications"
    fi

    if [ -w "$HOME/.local/share/applications" ]; then
      ${pkgs.desktop-file-utils}/bin/update-desktop-database "$HOME/.local/share/applications"
    fi
  '';
}
