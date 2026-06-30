{ pkgs, ... }:
let
  inherit (import ../_nixgl-wrappers.nix { inherit pkgs; }) mkWrappedBinary;
  vicinae = mkWrappedBinary {
    name = "vicinae";
    package = pkgs.vicinae;
  };
in
{
  home.packages = [ vicinae ];

  systemd.user.services.vicinae = {
    Unit = {
      Description = "Vicinae server daemon";
      After = [ "graphical-session.target" ];
      PartOf = [ "graphical-session.target" ];
    };

    Service = {
      Type = "simple";
      ExecStart = "${vicinae}/bin/vicinae server --replace";
      Restart = "always";
      RestartSec = 60;
      KillMode = "process";
    };

    Install = {
      WantedBy = [ "graphical-session.target" ];
    };
  };

  xdg.desktopEntries.vicinae = {
    name = "Vicinae";
    genericName = "Utility";
    comment = "Launch Vicinae through the nixGL wrapper";
    exec = "${vicinae}/bin/vicinae";
    terminal = false;
    categories = [ "Utility" ];
    icon = "vicinae";
    startupNotify = true;
  };
}
