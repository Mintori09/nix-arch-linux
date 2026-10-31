{ pkgs, ... }:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
in

pkgs.stdenv.mkDerivation {
  inherit (sources.caesium-clt) pname version src;

  sourceRoot = "caesiumclt-v${sources.caesium-clt.version}-x86_64-unknown-linux-musl";

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
