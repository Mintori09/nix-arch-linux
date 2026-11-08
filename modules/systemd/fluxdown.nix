{ pkgs, ... }:

{
  systemd.user.services.fluxdown = {
    Unit = {
      Description = "FluxDown Agent & Download Daemon";
      Documentation = [ "https://github.com/zerx-lab/FluxDown" ];
      PartOf = [ "graphical-session.target" ];
      After = [ "graphical-session.target" ];
    };

    Service = {
      Type = "simple";
      ExecStart = "${pkgs.fluxdown}/bin/fluxdown-agent";
      Restart = "on-failure";
      RestartSec = "2s";
      KillMode = "mixed";
    };

    Install = {
      WantedBy = [ "graphical-session.target" ];
    };
  };
}
