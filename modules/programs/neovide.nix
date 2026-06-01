{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.programs.neovide;
in
{
  programs.neovide = {
    enable = true;
  };

  xdg.desktopEntries.neovide = lib.mkIf cfg.enable {
    name = "Neovide";
    exec = "${cfg.package}/bin/neovide %F";
    icon = "neovide";
    categories = [
      "Development"
      "IDE"
      "TextEditor"
    ];
    mimeType = [ "text/plain" ];
    terminal = false;
    type = "Application";
  };
}
