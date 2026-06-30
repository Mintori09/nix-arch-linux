{ pkgs, ... }:
let
  inherit (import ../_nixgl-wrappers.nix { inherit pkgs; }) mkWrappedBinary;
  foliate = mkWrappedBinary {
    name = "foliate";
    package = pkgs.foliate;
  };
in
{
  home.packages = [ foliate ];

  xdg.desktopEntries.foliate = {
    name = "Foliate";
    genericName = "E-book Reader";
    comment = "Read EPUB books";
    exec = "${foliate}/bin/foliate";
    terminal = false;
    categories = [
      "Office"
      "Viewer"
    ];
    icon = "foliate";
    startupNotify = true;
  };
}
