{ pkgs, ... }:
let
  inherit (import ../_nixgl-wrappers.nix { inherit pkgs; }) mkWrappedBinary;
  zathura = mkWrappedBinary {
    name = "zathura";
    package = pkgs.zathura;
  };
in
{
  home.packages = [
    pkgs.zathuraPkgs.zathura_pdf_mupdf
    pkgs.zathuraPkgs.zathura_pdf_poppler
    zathura
  ];
}
