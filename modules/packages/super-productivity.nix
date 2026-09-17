{ pkgs, ... }:

let
  pname = "super-productivity";
  version = "18.21.2";

  src = pkgs.fetchurl {
    url = "https://github.com/super-productivity/super-productivity/releases/download/v${version}/superProductivity-x86_64.AppImage";
    hash = "sha256-y7xZBLOiW+LLGJMSoWup+WxbcQg0qX3GnHHkTDEKmCU=";
  };

  appimageContents = pkgs.appimageTools.extract { inherit pname version src; };
in

pkgs.appimageTools.wrapType2 {
  inherit pname version src;

  extraInstallCommands = ''
    install -m 444 -D ${appimageContents}/superproductivity.desktop $out/share/applications/superproductivity.desktop
    substituteInPlace $out/share/applications/superproductivity.desktop \
      --replace-fail 'Exec=AppRun --no-sandbox %U' "Exec=$out/bin/${pname} --ozone-platform-hint=auto %U"

    mkdir -p $out/share/icons
    cp -r ${appimageContents}/usr/share/icons/* $out/share/icons/
  '';

  meta = with pkgs.lib; {
    description = "Advanced todo list app with integrated Timeboxing and time tracking capabilities";
    homepage = "https://github.com/super-productivity/super-productivity";
    license = licenses.mit;
    platforms = [ "x86_64-linux" ];
    mainProgram = "super-productivity";
  };
}
