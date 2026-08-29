{ ... }:
{
  systemd.user.services.anyrun = {
    Unit = {
      Description = "Anyrun daemon runner";
      Documentation = [ "https://github.com/Mintori09/anyrun-fork" ];
      PartOf = [ "graphical-session.target" ];
      After = [ "graphical-session.target" ];
    };

    Service = {
      Type = "simple";
      ExecStart = "/usr/bin/anyrun daemon";
      ExecReload = "/usr/bin/anyrun reload";
      ExecStop = "/usr/bin/anyrun quit";
      Restart = "on-failure";
      RestartSec = "1s";
      KillMode = "process";
    };

    Install = {
      WantedBy = [ "graphical-session.target" ];
    };
  };
}
