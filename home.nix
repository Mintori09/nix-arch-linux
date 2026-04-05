{ ... }:
{
  home.username = "mintori";
  home.homeDirectory = "/home/mintori";
  home.stateVersion = "23.11";

  imports = [
    ./modules
    ./modules/packages.nix
  ];

  programs.home-manager.enable = true;
}
