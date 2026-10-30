{ pkgs, ... }:

let
  pname = "qbittorrent";
  version = "5.3.0";

  src = pkgs.fetchurl {
    url = "https://github.com/qbittorrent/qBittorrent/releases/download/release-${version}/qbittorrent-${version}_x86_64.AppImage";
    hash = "sha256-HGTy6VdAvkHygi+Qn1bk3Q2iY38xIJigbaET163XQYs=";
  };

  appimageContents = pkgs.appimageTools.extract { inherit pname version src; };
in

pkgs.appimageTools.wrapType2 {
  inherit pname version src;

  extraInstallCommands = ''
    install -m 444 -D ${appimageContents}/org.qbittorrent.qBittorrent.desktop $out/share/applications/org.qbittorrent.qBittorrent.desktop
    install -m 444 -D ${appimageContents}/qbittorrent.svg $out/share/icons/hicolor/scalable/apps/qbittorrent.svg
  '';

  meta = with pkgs.lib; {
    description = "Free and reliable P2P BitTorrent client";
    homepage = "https://github.com/qbittorrent/qBittorrent";
    license = licenses.gpl2Plus;
    platforms = [ "x86_64-linux" ];
    mainProgram = "qbittorrent";
  };
}
