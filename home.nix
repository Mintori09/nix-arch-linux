{
  pkgs,
  config,
  nixgl,
  ...
}:
{
  home.username = "mintori";
  home.homeDirectory = "/home/mintori";
  home.stateVersion = "26.05";

  xdg.enable = true;
  targets.genericLinux.enable = true;
  targets.genericLinux.nixGL.packages = nixgl.packages.${pkgs.system};
  home.packages = [
  ];

  imports = [
    ./modules
    ./modules/packages.nix
  ];

  programs.home-manager.enable = true;
}
