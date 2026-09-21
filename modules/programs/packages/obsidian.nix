{ pkgs, ... }:
let
  inherit (import ../_nixgl-wrappers.nix { inherit pkgs; }) mkWrappedBinary;
  obsidian = mkWrappedBinary {
    name = "obsidian";
    package = pkgs.obsidian;
  };
in
{
  programs.obsidian = {
    enable = true;
    package = obsidian;
  };

  xdg.desktopEntries.obsidian = {
    name = "Obsidian";
    genericName = "Knowledge Base";
    comment = "Markdown knowledge base";
    exec = "${obsidian}/bin/obsidian %u";
    terminal = false;

    startupNotify = true;

    categories = [
      "Office"
      "Utility"
    ];

    mimeType = [
      "x-scheme-handler/obsidian"
    ];

    icon = "obsidian";
  };
}
