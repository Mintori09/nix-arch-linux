{ pkgs, ... }:

let
  version = "1.1.0";
in
pkgs.stdenv.mkDerivation {
  pname = "magika";
  inherit version;

  src = pkgs.fetchurl {
    url = "https://github.com/google/magika/releases/download/cli/v${version}/magika-cli-x86_64-unknown-linux-gnu.tar.xz";
    hash = "sha256-a0wQEMhNH08GIFzO9Fl/FpC813RPRthB7uJkJrwQBIU=";
  };

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
