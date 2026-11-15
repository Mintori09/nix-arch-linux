{ pkgs, ... }:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
  inherit (sources.neovide) pname version src;

  runtimeLibs = [
    pkgs.wayland
    pkgs.libxkbcommon
    pkgs.libglvnd
    pkgs.libx11
    pkgs.libxcursor
    pkgs.libxext
    pkgs.libxrandr
    pkgs.libxi
    pkgs.vulkan-loader
  ];

  libPath = pkgs.lib.makeLibraryPath runtimeLibs;
in

pkgs.stdenv.mkDerivation {
  inherit pname version src;

  sourceRoot = ".";

  nativeBuildInputs = [
    pkgs.autoPatchelfHook
    pkgs.makeWrapper
  ];

  buildInputs = [
    pkgs.stdenv.cc.cc.lib
    pkgs.fontconfig
    pkgs.freetype
    pkgs.zlib
    pkgs.libpng
    pkgs.expat
    pkgs.bzip2
    pkgs.brotli
  ]
  ++ runtimeLibs;

  runtimeDependencies = runtimeLibs;

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin
    cp neovide $out/bin/

    wrapProgram $out/bin/neovide \
      --prefix LD_LIBRARY_PATH : "${libPath}"

    install -m 444 -D ${./neovide.svg} $out/share/icons/hicolor/scalable/apps/neovide.svg

    runHook postInstall
  '';

  meta = with pkgs.lib; {
    description = "No Nonsense Neovim Client in Rust";
    homepage = "https://github.com/neovide/neovide";
    license = licenses.mit;
    platforms = [ "x86_64-linux" ];
    mainProgram = "neovide";
  };
}
