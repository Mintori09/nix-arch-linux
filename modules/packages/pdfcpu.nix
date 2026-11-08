{ pkgs, ... }:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
in

pkgs.stdenv.mkDerivation {
  inherit (sources.pdfcpu) pname version src;

  sourceRoot = "pdfcpu_${sources.pdfcpu.version}_Linux_x86_64";

  installPhase = ''
    install -Dm755 pdfcpu $out/bin/pdfcpu
  '';

  meta = with pkgs.lib; {
    description = "A PDF processor written in Go";
    homepage = "https://github.com/pdfcpu/pdfcpu";
    license = licenses.asl20;
    platforms = [ "x86_64-linux" ];
    mainProgram = "pdfcpu";
  };
}
