{ pkgs, ... }:
let
  inherit (import ../_nixgl-wrappers.nix { inherit pkgs; }) mkWrappedBinary;
  kcolorchooser = mkWrappedBinary {
    name = "kcolorchooser";
    package = pkgs.kdePackages.kcolorchooser;
  };
in
{
  home.packages = [ kcolorchooser ];
}
