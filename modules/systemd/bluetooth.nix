{ ... }:
{
  systemd.user.services.bluetooth-power = {
    Unit = {
      Description = "Enable Bluetooth adapter";
      After = [ "graphical-session.target" ];
      Wants = [ "graphical-session.target" ];
    };

    Service = {
      Type = "oneshot";
      ExecStart = "/usr/bin/bluetoothctl power on";
      RemainAfterExit = true;
    };

    Install = {
      WantedBy = [ "default.target" ];
    };
  };
}
