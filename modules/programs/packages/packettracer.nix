{ pkgs, ... }:
let
  packettracer = pkgs.writeShellScriptBin "packettracer" ''
    export QT_QPA_PLATFORM=xcb
    export PATH="$HOME/.local/bin/helpers:$PATH"
    exec /usr/lib/packettracer/packettracer.AppImage "$@"
  '';
in
{
  home.packages = [ packettracer ];

  xdg.desktopEntries.packettracer = {
    name = "Cisco Packet Tracer";
    genericName = "Network Simulation Tool";
    comment = "Visual network simulation and configuration tool";
    exec = "${packettracer}/bin/packettracer %U";
    terminal = false;
    categories = [
      "Education"
      "Development"
      "Network"
    ];
    icon = "Cisco_Packet_Tracer_9.0.1";
    mimeType = [
      "application/x-pkt"
      "application/x-pka"
      "application/x-pkz"
      "x-scheme-handler/pttp"
    ];
  };

  xdg.desktopEntries."CiscoPacketTracer-9.0.1" = {
    name = "Cisco Packet Tracer 9.0.1";
    exec = "";
    settings.NoDisplay = "true";
  };

  xdg.desktopEntries."CiscoPacketTracerPtsa-9.0.1" = {
    name = "Cisco Packet Tracer 9.0.1 (PTSA)";
    exec = "";
    settings.NoDisplay = "true";
  };
}
