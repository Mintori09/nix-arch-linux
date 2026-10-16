{ pkgs, ... }:

let
  version = "0.6.45";
in

pkgs.stdenv.mkDerivation {
  pname = "dbx";
  inherit version;

  src = pkgs.fetchurl {
    url = "https://github.com/t8y2/dbx/releases/download/v${version}/DBX_${version}_amd64.deb";
    hash = "sha256-F6542iJte31T5D3CoNFxCs+X7e0CjbkZKwoZAswwvJA=";
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
