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
  nixpkgs.config.allowUnfree = true;
  targets.genericLinux.enable = true;
  targets.genericLinux.nixGL.packages = nixgl.packages.${pkgs.stdenv.hostPlatform.system};
  programs.home-manager.enable = true;

  imports = [
    ./modules
    ./modules/packages.nix
  ];

}
