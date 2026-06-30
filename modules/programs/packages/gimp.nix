{ pkgs, ... }:
let
  inherit (import ../_nixgl-wrappers.nix { inherit pkgs; }) mkWrappedBinary;
  gimp = mkWrappedBinary {
    name = "gimp";
    package = pkgs.gimp;
  };
in
{
  home.packages = [ gimp ];

  xdg.desktopEntries.gimp = {
    name = "GIMP";
    genericName = "Image Editor";
    comment = "Create images and edit photographs";
    exec = "${gimp}/bin/gimp";
    terminal = false;
    categories = [
      "Graphics"
      "2DGraphics"
      "RasterGraphics"
    ];
    icon = "gimp";
    startupNotify = true;
  };
}
