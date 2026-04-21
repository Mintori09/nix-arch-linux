{ config, pkgs, ... }:

{
  programs.qutebrowser = {
    enable = true;
    keyBindings = {
      normal = {
        "m" = "spawn mpv {url}";
      };
    };
    package = config.lib.nixGL.wrap pkgs.qutebrowser;
  };
}
