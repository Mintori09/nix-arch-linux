{ pkgs, ... }:

let
  pname = "zed-editor";
  version = "1.20.2";

  rpath = pkgs.lib.makeLibraryPath (with pkgs; [
    stdenv.cc.cc.lib
    alsa-lib
    fontconfig
    glib
    libxkbcommon
    wayland
    vulkan-loader
    libGL
    libx11
    libxcb
  ]);
in

pkgs.stdenv.mkDerivation {
  inherit pname version;

  src = pkgs.fetchurl {
    url = "https://github.com/zed-industries/zed/releases/download/v${version}/zed-linux-x86_64.tar.gz";
    hash = "sha256-ZH3IXgn82ZzRdTZaibe3DM+WRpxIROuK5uuD36gvdgA=";
  };

  nativeBuildInputs = [
    pkgs.autoPatchelfHook
    pkgs.makeBinaryWrapper
  ];

  buildInputs = with pkgs; [
    stdenv.cc.cc.lib
    alsa-lib
    fontconfig
    glib
    libxkbcommon
    wayland
    vulkan-loader
    libGL
    libx11
    libxcb
  ];

  installPhase = ''
    runHook preInstall

    mkdir -p $out
    cp -r bin libexec lib share $out/
    ln -s $out/bin/zed $out/bin/zeditor

    runHook postInstall
  '';

  postFixup = ''
    wrapProgram $out/libexec/zed-editor \
      --prefix LD_LIBRARY_PATH : "${rpath}"
  '';

  meta = with pkgs.lib; {
    description = "A high-performance, multiplayer code editor";
    homepage = "https://github.com/zed-industries/zed";
    license = licenses.gpl3Only;
    platforms = [ "x86_64-linux" ];
    mainProgram = "zed";
  };
}
