{ pkgs, ... }:

let
  version = "0.5.72";
in

pkgs.stdenv.mkDerivation {
  pname = "dbx";
  inherit version;

  src = pkgs.fetchurl {
    url = "https://github.com/t8y2/dbx/releases/download/v${version}/DBX_${version}_amd64.deb";
    hash = "sha256-nWkLUVaWPOTfedWHIa/UZcZE3NeXIsAz1/Wj3JNf52U=";
  };

  dontUnpack = true;

  installPhase = ''
    ar x $src
    tar xf data.tar.gz

    mkdir -p $out/bin $out/share
    cp usr/bin/dbx $out/bin/
    cp -r usr/share/applications $out/share/
    cp -r usr/share/icons $out/share/
  '';

  meta = with pkgs.lib; {
    description = "Lightweight, cross-platform database client (60+ databases)";
    homepage = "https://github.com/t8y2/dbx";
    license = licenses.asl20;
    platforms = [ "x86_64-linux" ];
    mainProgram = "dbx";
  };
}
