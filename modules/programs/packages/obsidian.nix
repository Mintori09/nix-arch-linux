{ pkgs, ... }:

let
  inherit (import ../_nixgl-wrappers.nix { inherit pkgs; }) mkWrappedBinary;
  obsidian = mkWrappedBinary {
    name = "obsidian";
    package = pkgs.obsidian;
  };
in
{
  home.packages = [ obsidian ];

  xdg.desktopEntries."md.obsidian.Obsidian" = {
    name = "Obsidian";
    genericName = "Knowledge Base";
    comment = "Markdown knowledge base";
    icon = "obsidian";
    exec = "${obsidian}/bin/obsidian %u";
    terminal = false;

    startupNotify = true;

    categories = [
      "Office"
    ];
    mimeType = [
      "x-scheme-handler/obsidian"
    ];
    settings = {
      StartupWMClass = "md.obsidian.Obsidian";
    };
  };
}
