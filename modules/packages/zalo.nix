{ pkgs, ... }:

let
  pname = "zalo";
  version = "26.11.10";
  src = pkgs.fetchurl {
    url = "https://github.com/VN-Linux-Family/zalo-for-linux/releases/download/${version}/Zalo-${version}%2BZaDark-26.3-784f24f-x86_64.AppImage";
    hash = "sha256-Tk0ySIFh2+p9YSiESqp/LotbqmjXolI0dnb5GOKSNkw=";
  };

  contents = pkgs.runCommand "${pname}-${version}-extracted" { } ''
    mkdir -p $out
    cp ${src} ./appimage
    chmod +x ./appimage
    ./appimage --appimage-dwarfsextract -i ./appimage -o $out -O 1507016 --continue-on-error || true
    chmod -R u+w $out
  '';
in

pkgs.appimageTools.wrapAppImage {
  inherit pname version;
  src = contents;

  extraPkgs = pkgs: with pkgs; [
    libopus
    pulseaudio
    python3
  ];

  extraInstallCommands = ''
    install -m 444 -D ${contents}/zalo.desktop $out/share/applications/zalo.desktop
    substituteInPlace $out/share/applications/zalo.desktop \
      --replace-fail 'Exec=AppRun --no-sandbox %U' "Exec=$out/bin/${pname} --no-sandbox %U"
    install -m 444 -D ${contents}/usr/share/icons/hicolor/512x512/apps/zalo.png $out/share/icons/hicolor/512x512/apps/zalo.png
  '';

  meta = with pkgs.lib; {
    description = "Unofficial port of Zalo messaging application for Linux systems";
    homepage = "https://github.com/VN-Linux-Family/zalo-for-linux";
    license = licenses.unfree;
    platforms = [ "x86_64-linux" ];
    mainProgram = "zalo";
  };
}
