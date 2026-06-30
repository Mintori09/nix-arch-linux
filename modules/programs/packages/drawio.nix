{ pkgs, ... }:
let
  inherit (import ../_nixgl-wrappers.nix { inherit pkgs; }) mkWrappedBinary;
  drawio = mkWrappedBinary {
    name = "drawio";
    package = pkgs.drawio;
  };
in
{
  home.packages = [ drawio ];

  xdg.desktopEntries.drawio = {
    name = "Draw.io";
    genericName = "Diagram Editor";
    comment = "Create diagrams and flowcharts";
    exec = "${drawio}/bin/drawio";
    terminal = false;
    categories = [
      "Graphics"
      "Office"
    ];
    icon = "drawio";
    startupNotify = true;
  };
}
