{ pkgs, ... }:
let
  inherit (import ../_nixgl-wrappers.nix { inherit pkgs; }) mkWrappedBinary;
  sioyek = mkWrappedBinary {
    name = "sioyek";
    package = pkgs.sioyek;
  };
in
{
  home.packages = [ sioyek ];
}
