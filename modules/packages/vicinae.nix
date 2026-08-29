{ pkgs, ... }:

let
  pname = "vicinae";
  version = "0.27.4";

  src = pkgs.fetchurl {
    url = "https://github.com/vicinaehq/vicinae/releases/download/v${version}/Vicinae-x86_64.AppImage";
    hash = "sha256-OvTGyNi29yodFw3WOShzU3IaEN4eDQIdoNreKd4HFSk=";
  };

  appimageContents = pkgs.appimageTools.extract { inherit pname version src; };
in

pkgs.appimageTools.wrapType2 {
  inherit pname version src;

  extraInstallCommands = ''
    install -m 444 -D ${appimageContents}/vicinae.desktop $out/share/applications/vicinae.desktop
    install -m 444 -D ${appimageContents}/vicinae.png $out/share/icons/hicolor/512x512/apps/vicinae.png
  '';

  meta = with pkgs.lib; {
    description = "Focused, fast, and fully extensible application launcher for Linux";
    homepage = "https://github.com/vicinaehq/vicinae";
    license = licenses.gpl3Plus;
    platforms = [ "x86_64-linux" ];
    mainProgram = "vicinae";
  };
}
