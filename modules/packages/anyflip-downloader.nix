{ pkgs, ... }:

let
  version = "0.1.14";
in

pkgs.stdenv.mkDerivation {
  pname = "anyflip-downloader";
  inherit version;

  src = pkgs.fetchurl {
    url = "https://github.com/Lofter1/anyflip-downloader/releases/download/v${version}/anyflip-downloader_${version}_linux_amd64.tar.gz";
    hash = "sha256-/PndrBIjiC1KkDRIA57/tO81HoKM1tHLQLAOoqjBQww=";
  };

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
