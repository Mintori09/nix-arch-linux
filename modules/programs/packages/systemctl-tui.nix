{ pkgs, ... }:
{
  home.packages = [ pkgs.systemctl-tui ];

  xdg.desktopEntries.systemctl-tui = {
    name = "systemctl-tui";
    genericName = "Systemd Management TUI";
    comment = "A fast and simple TUI for systemd services and units";
    exec = "kitty --class systemctl-tui -e ${pkgs.systemctl-tui}/bin/systemctl-tui";
    terminal = false;
    categories = [
      "System"
      "Monitor"
      "Settings"
    ];
    icon = "system-shutdown";
  };
}
