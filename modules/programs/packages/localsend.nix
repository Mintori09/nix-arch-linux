{ pkgs, ... }:
let
  inherit (import ../_nixgl-wrappers.nix { inherit pkgs; }) mkWrappedBinary;
  localsend = mkWrappedBinary {
    name = "localsend";
    binaryName = "localsend_app";
    package = pkgs.localsend;
  };
in
{
  home.packages = [ localsend ];

  xdg.desktopEntries.localsend = {
    name = "LocalSend";
    genericName = "File Sharing";
    comment = "Share files across devices";
    exec = "${localsend}/bin/localsend_app";
    terminal = false;
    categories = [
      "Network"
      "FileTransfer"
      "Utility"
    ];
    icon = "localsend";
    startupNotify = true;
  };
}
