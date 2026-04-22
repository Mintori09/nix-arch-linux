{ config, pkgs, ... }:
{
  home.packages = [
    (config.lib.nixGL.wrap pkgs.hoppscotch)
  ];
}
