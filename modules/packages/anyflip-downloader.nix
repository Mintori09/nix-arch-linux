{ pkgs, ... }:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
in

pkgs.stdenv.mkDerivation {
  inherit (sources.anyflip-downloader) pname version src;

  sourceRoot = ".";

  installPhase = ''
    mkdir -p $out/bin
    cp anyflip-downloader $out/bin/
    chmod +x $out/bin/anyflip-downloader
  '';

  meta = with pkgs.lib; {
    description = "CLI tool to download books from AnyFlip";
    homepage = "https://github.com/Lofter1/anyflip-downloader";
    license = licenses.mit;
    platforms = [ "x86_64-linux" ];
    mainProgram = "anyflip-downloader";
  };
}
