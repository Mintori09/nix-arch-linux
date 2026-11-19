{ pkgs, ... }:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
in

pkgs.stdenv.mkDerivation {
  inherit (sources.rust-anything) pname version src;

  nativeBuildInputs = [
    pkgs.autoPatchelfHook
  ];

  buildInputs = [
    pkgs.stdenv.cc.cc.lib
  ];

  installPhase = ''
    runHook preInstall

    install -Dm755 rust-anything $out/bin/rust-anything

    runHook postInstall
  '';

  meta = with pkgs.lib; {
    description = "Rewrite your whole app in Rust, one piece at a time, checked against recorded behavior";
    homepage = "https://github.com/erkamyaman/rust-anything";
    license = licenses.mit;
    platforms = [ "x86_64-linux" ];
    mainProgram = "rust-anything";
  };
}
