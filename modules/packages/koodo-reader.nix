{ pkgs, ... }:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
  inherit (sources.koodo-reader) pname version src;

  appimageContents = pkgs.appimageTools.extract { inherit pname version src; };
in

pkgs.appimageTools.wrapType2 {
  inherit pname version src;

  extraInstallCommands = ''
    install -m 444 -D ${appimageContents}/koodo-reader.desktop $out/share/applications/koodo-reader.desktop
    substituteInPlace $out/share/applications/koodo-reader.desktop \
      --replace-fail 'Exec=AppRun --no-sandbox %U' "Exec=$out/bin/${pname} %U"

    cp -r ${appimageContents}/usr/share/icons $out/share/
    [ -d ${appimageContents}/usr/share/mime ] && cp -r ${appimageContents}/usr/share/mime $out/share/
  '';

  meta = with pkgs.lib; {
    description = "A modern ebook manager and reader with sync and backup capacities";
    homepage = "https://github.com/koodo-reader/koodo-reader";
    license = licenses.agpl3Only;
    platforms = [ "x86_64-linux" ];
    mainProgram = "koodo-reader";
  };
}
