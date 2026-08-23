{ config, pkgs, ... }:

{
  xdg.configFile."navi/config.yaml".text = ''
    finder:
      overrides: "+e"
  '';

  xdg.dataFile."navi/cheats/mintori".source = ./cheats;
}
