{
  config,
  pkgs,
  nixgl,
  ...
}:

{
  programs.mpv = {
    enable = true;
    package = config.lib.nixGL.wrap pkgs.mpv;
  };
}
