{ pkgs, ... }:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
in
pkgs.stdenv.mkDerivation {
  inherit (sources.magika) pname version src;

  sourceRoot = "magika-cli-x86_64-unknown-linux-gnu";

  nativeBuildInputs = [
    pkgs.autoPatchelfHook
  ];

  buildInputs = [
    pkgs.stdenv.cc.cc.lib
  ];

  installPhase = ''
    install -Dm755 magika $out/bin/magika
  '';

  meta = with pkgs.lib; {
    description = "Detect file content types with deep learning (official Google Magika Rust CLI)";
    homepage = "https://github.com/google/magika";
    license = licenses.asl20;
    platforms = [ "x86_64-linux" ];
    mainProgram = "magika";
  };
}
