{ pkgs, ... }:

let
  inherit (import ../_nixgl-wrappers.nix { inherit pkgs; }) mkWrappedBinary;
  sheprd = mkWrappedBinary {
    name = "sheprd";
    package = pkgs.sheprd;
  };
in
{
  home.packages = [ sheprd ];

  xdg.desktopEntries.sheprd = {
    name = "Sheprd";
    genericName = "Native GPUI Client";
    comment = "Native client for an existing local Herdr daemon";
    icon = "sheprd";
    exec = "${sheprd}/bin/sheprd %U";
    terminal = false;
    categories = [ "Development" ];
    settings = {
      StartupWMClass = "so.pen.herdr-gpui";
    };
  };
}
