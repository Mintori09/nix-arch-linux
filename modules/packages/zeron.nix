{
  pkgs,
  lib,
  stdenv,
  autoPatchelfHook,
  makeWrapper,
  alsa-lib,
  zlib,
  wayland,
  libxkbcommon,
  vulkan-loader,
  libGL,
  libxcb,
  webkitgtk_4_1,
  gtk3,
  glib,
  glib-networking,
  cairo,
  atk,
  gdk-pixbuf,
  libsoup_3,
  ...
}:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
  inherit (sources.zeron) pname version src;

  runtimeLibs = [
    vulkan-loader
    wayland
    libGL
    libxkbcommon
    libxcb
    webkitgtk_4_1
    gtk3
    glib
    cairo
    atk
    gdk-pixbuf
    libsoup_3
  ];
in

stdenv.mkDerivation {
  inherit pname version src;

  sourceRoot = ".";

  nativeBuildInputs = [
    autoPatchelfHook
    makeWrapper
  ];

  buildInputs = [
    stdenv.cc.cc.lib
    alsa-lib
    zlib
  ]
  ++ runtimeLibs;

  runtimeDependencies = runtimeLibs;

  installPhase = ''
    runHook preInstall

    cd zeron-*

    mkdir -p $out/lib/zeron $out/bin
    cp -r zeron zeron-engine ui plugins-builtin $out/lib/zeron/
    chmod +x $out/lib/zeron/zeron $out/lib/zeron/zeron-engine
    wrapProgram $out/lib/zeron/zeron \
      --prefix LD_LIBRARY_PATH : "${lib.makeLibraryPath runtimeLibs}" \
      --prefix GIO_EXTRA_MODULES : "${glib-networking}/lib/gio/modules"
    ln -s $out/lib/zeron/zeron $out/bin/zeron

    install -Dm644 zeron.png $out/share/icons/hicolor/1024x1024/apps/zeron.png
    install -Dm644 zeron.png $out/share/pixmaps/zeron.png
    install -Dm644 zeron.desktop $out/share/applications/zeron.desktop
    substituteInPlace $out/share/applications/zeron.desktop \
      --replace-fail 'Exec=zeron %u' "Exec=$out/bin/zeron %u" \
      --replace-fail 'TryExec=zeron' "TryExec=$out/bin/zeron" \
      --replace-fail 'Icon=zeron' "Icon=$out/share/icons/hicolor/1024x1024/apps/zeron.png"

    runHook postInstall
  '';

  meta = with lib; {
    description = "A native control plane for Claude Code, Codex, Cursor, Devin and other coding agents";
    homepage = "https://github.com/zeronsh/zeron";
    license = licenses.mit;
    platforms = [ "x86_64-linux" ];
    mainProgram = "zeron";
  };
}
