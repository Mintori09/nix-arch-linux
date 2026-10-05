{ pkgs, ... }:
{
  home.packages = with pkgs; [
    copyq
  ];

  systemd.user.services.copyq = {
    Unit = {
      Description = "CopyQ clipboard management daemon";
      Documentation = [ "https://github.com/hluk/CopyQ" ];
      PartOf = [ "graphical-session.target" ];
      After = [ "graphical-session.target" ];
    };

    Service = {
      Type = "simple";
      ExecStart = "${pkgs.copyq}/bin/copyq";
      ExecStop = "${pkgs.copyq}/bin/copyq exit";
      Restart = "on-failure";
      RestartSec = "1s";
      KillMode = "process";
    };

    Install = {
      WantedBy = [ "graphical-session.target" ];
    };
  };
}
