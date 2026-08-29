{ pkgs, ... }:
{
  systemd.user.services.keyboard-rs = {
    Unit = {
      Description = "Keyboard serial macro daemon";
      Documentation = [ "https://github.com/Mintori09/keyboard-serial" ];
      PartOf = [ "graphical-session.target" ];
      After = [ "graphical-session.target" ];
    };

    Service = {
      Type = "simple";
      ExecStart = "${pkgs.keyboard-rs}/bin/keyboard-rs";
      Restart = "on-failure";
      RestartSec = "2s";
      KillMode = "process";
    };

    Install = {
      WantedBy = [ "graphical-session.target" ];
    };
  };

  xdg.desktopEntries.keyboard-rs-config = {
    name = "Keyboard-rs Config";
    genericName = "Keyboard Macro Configurator";
    comment = "Configure keyboard-rs profiles and macros";
    exec = "${pkgs.keyboard-rs}/bin/keyboard-rs-config";
    icon = "preferences-system";
    terminal = false;
    categories = [
      "Utility"
      "Settings"
    ];
    startupNotify = true;
  };
}
