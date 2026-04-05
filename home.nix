{ ... }:
{
  home.username = "mintori";
  home.homeDirectory = "/home/mintori";
  home.stateVersion = "23.11";

  imports = [
    ./modules/packages.nix
    ./modules/shell.nix
    ./modules/yazi.nix
    ./shell/environment.nix
    ./programs
    ./scripts
    ./shell
  ];

  programs.home-manager.enable = true;
}
