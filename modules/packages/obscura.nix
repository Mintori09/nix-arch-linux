{
  pkgs,
  lib,
  stdenv,
  autoPatchelfHook,
  ...
}:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
  inherit (sources.obscura) pname version src;
in

stdenv.mkDerivation {
  inherit pname version src;

  sourceRoot = ".";

  nativeBuildInputs = [
    autoPatchelfHook
  ];

  buildInputs = [
    stdenv.cc.cc.lib
  ];

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin
    cp -p obscura obscura-worker $out/bin/
    chmod +x $out/bin/obscura $out/bin/obscura-worker

    runHook postInstall
  '';

  meta = with lib; {
    description = "Lightweight, stealthy headless browser for AI agents and web scraping";
    homepage = "https://github.com/h4ckf0r0day/obscura";
    license = licenses.asl20;
    platforms = [ "x86_64-linux" ];
    mainProgram = "obscura";
  };
}
