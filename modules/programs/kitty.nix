{ config, pkgs, ... }:

{
  programs.kitty = {
    enable = true;
    package = pkgs.writeShellScriptBin "kitty" ''
      #!/bin/sh
      nixGL ${pkgs.mpv}/bin/kitty "$@"
    '';
  };
}
