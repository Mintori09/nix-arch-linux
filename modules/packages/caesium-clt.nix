{ pkgs, ... }:

let
  version = "1.5.0";
in

pkgs.stdenv.mkDerivation {
  pname = "caesium-clt";
  inherit version;

  src = pkgs.fetchurl {
    url = "https://github.com/Lymphatus/caesium-clt/releases/download/v${version}/caesiumclt-v${version}-x86_64-unknown-linux-musl.tar.gz";
    hash = "sha256-IVqens3lTRylcB7gKZ0JFqoKFTuOzWPKDoMsjv3KLNU=";
  };

  sourceRoot = "caesiumclt-v${version}-x86_64-unknown-linux-musl";

  installPhase = ''
    install -Dm755 caesiumclt $out/bin/caesiumclt
  '';

  meta = with pkgs.lib; {
    description = "Caesium Command Line Tools - Lossy/lossless image compression tool";
    homepage = "https://github.com/Lymphatus/caesium-clt";
    license = licenses.asl20;
    platforms = [ "x86_64-linux" ];
    mainProgram = "caesiumclt";
  };
}
