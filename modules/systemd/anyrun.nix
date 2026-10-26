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

      Environment = [
        "GDK_BACKEND=wayland"
      ];
      UnsetEnvironment = [
        "DISPLAY"
      ];

      MemoryHigh = "300M";
      MemoryMax = "450M";

      TimeoutStopSec = "5s";
      Restart = "on-failure";
      RestartSec = "2s";
    };

    Install = {
      WantedBy = [ "graphical-session.target" ];
    };
  };
}
