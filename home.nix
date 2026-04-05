{ ... }:
{
  home.username = "mintori";
  home.homeDirectory = "/home/mintori";
  home.stateVersion = "26.05";

  xdg.enable = true;

  imports = [
    ./modules
    ./modules/packages.nix
  ];

  programs.home-manager.enable = true;
}
