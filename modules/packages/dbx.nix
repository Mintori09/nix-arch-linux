{ pkgs, ... }:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
in

pkgs.stdenv.mkDerivation {
  inherit (sources.dbx) pname version src;

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
