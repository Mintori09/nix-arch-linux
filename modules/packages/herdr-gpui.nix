{
  pkgs,
  lib,
  stdenv,
  autoPatchelfHook,
  alsa-lib,
  libxcb,
  libxau,
  libxdmcp,
  libxkbcommon,
  vulkan-loader,
  wayland,
  libGL,
  ...
}:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
  inherit (sources.herdr-gpui) pname version src;
in

stdenv.mkDerivation {
  inherit pname version src;

  sourceRoot = ".";

  nativeBuildInputs = [
    autoPatchelfHook
  ];

  buildInputs = [
    alsa-lib
    libxcb
    libxau
    libxdmcp
    libxkbcommon
    vulkan-loader
    wayland
    libGL
    stdenv.cc.cc.lib
  ];

  runtimeDependencies = [
    vulkan-loader
    wayland
    libGL
  ];

  installPhase = ''
    runHook preInstall

    # Extract archive contents (Herdr-20261028.1-x86_64-unknown-linux-gnu/...)
    cd Herdr-*

    mkdir -p $out/bin $out/share
    cp -r bin/* $out/bin/
    cp -r share/* $out/share/

    runHook postInstall
  '';

  meta = with lib; {
    description = "Native GPUI client for Herdr";
    homepage = "https://github.com/penso/herdr-gpui";
    license = licenses.asl20;
    platforms = [ "x86_64-linux" ];
    mainProgram = "herdr-gpui";
  };
}
