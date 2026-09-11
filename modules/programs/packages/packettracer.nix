{ pkgs, ... }:
let
  makeCleanWrapper = name: pkgs.writeShellScriptBin name ''
    unset LD_LIBRARY_PATH
    if [ -x "/usr/bin/${name}" ]; then
      exec "/usr/bin/${name}" "$@"
    else
      exec /usr/bin/kde-open "$@"
    fi
  '';

  helpers = pkgs.symlinkJoin {
    name = "packettracer-helpers";
    paths = [
      (makeCleanWrapper "kde-open")
      (makeCleanWrapper "kde-open5")
      (makeCleanWrapper "kde-open6")
      (makeCleanWrapper "xdg-open")
    ];
  };

  packettracer = pkgs.writeShellScriptBin "packettracer" ''
    export QT_QPA_PLATFORM=xcb
    export PATH="${helpers}/bin:$PATH"
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
