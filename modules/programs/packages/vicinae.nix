{ pkgs, ... }:
let
  wrappedPkgs = import ./wrappers.nix { inherit pkgs; };
in
{
  home.packages = [ wrappedPkgs.vicinae ];

  systemd.user.services.vicinae = {
    Unit = {
      Description = "Vicinae server daemon";
      After = [ "graphical-session.target" ];
      PartOf = [ "graphical-session.target" ];
    };

    Service = {
      Type = "simple";
      ExecStart = "${wrappedPkgs.vicinae}/bin/vicinae server --replace";
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
    exec = "${wrappedPkgs.vicinae}/bin/vicinae";
    terminal = false;
    categories = [ "Utility" ];
    icon = "vicinae";
    startupNotify = true;
  };
}
