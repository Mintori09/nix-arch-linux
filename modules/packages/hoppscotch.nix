{ pkgs, ... }:

let
  pname = "hoppscotch";
  version = "26.8.0-0";

  src = pkgs.fetchurl {
    url = "https://github.com/hoppscotch/releases/releases/download/v${version}/Hoppscotch_linux_x64.AppImage";
    hash = "sha256-G+TmHOM3eS48TuGRCHznI9IxzF8wN6DtVDs9xOVdzPw=";
  };

  appimageContents = pkgs.appimageTools.extract { inherit pname version src; };
in

pkgs.appimageTools.wrapType2 {
  inherit pname version src;

  extraInstallCommands = ''
    install -m 444 -D ${appimageContents}/Hoppscotch.desktop $out/share/applications/Hoppscotch.desktop
    substituteInPlace $out/share/applications/Hoppscotch.desktop \
      --replace-fail 'Exec=hoppscotch-desktop' "Exec=$out/bin/${pname}"
    install -m 444 -D ${appimageContents}/Hoppscotch.png $out/share/icons/hicolor/256x256/apps/hoppscotch-desktop.png
  '';

  meta = with pkgs.lib; {
    description = "Open source API development ecosystem - Desktop App";
    homepage = "https://github.com/hoppscotch/hoppscotch";
    license = licenses.mit;
    platforms = [ "x86_64-linux" ];
    mainProgram = "hoppscotch";
  };
}
