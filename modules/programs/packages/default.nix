{ pkgs, ... }:
let
  wrappedPkgs = import ./wrappers.nix { inherit pkgs; };
in
{
  imports = [
    ./spicetify.nix
    ./vicinae.nix
    ./desktop-entries.nix
  ];

  programs.obsidian = {
    enable = true;
    package = wrappedPkgs.obsidian;
  };

  home.packages = with wrappedPkgs; [
    gimp
    foliate
    drawio
    localsend
  ];
}
