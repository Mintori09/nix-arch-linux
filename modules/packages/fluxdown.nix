{
  pkgs,
  lib,
  stdenv,
  autoPatchelfHook,
  # Runtime dependencies for GPUI/Wayland/X11
  alsa-lib,
  libxcb,
  libxau,
  libxdmcp,
  libxkbcommon,
  vulkan-loader,
  wayland,
  libGL,
  # Additional GTK / desktop integration dependencies for fluxdown-agent
  gtk3,
  glib,
  cairo,
  pango,
  gdk-pixbuf,
  fontconfig,
  freetype,
  atk,
  at-spi2-atk,
  dbus,
  libayatana-appindicator,
  libx11,
  libxcursor,
  libxrandr,
  libxi,
  libxext,
  libxfixes,
  libxrender,
  libxcomposite,
  libxdamage,
  libxinerama,
  ...
}:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
  inherit (sources.fluxdown) pname version src;
in

stdenv.mkDerivation {
  inherit pname version src;

  sourceRoot = ".";

  nativeBuildInputs = [
    autoPatchelfHook
  ];

  buildInputs = [
    stdenv.cc.cc.lib
    alsa-lib
    libxcb
    libxau
    libxdmcp
    libxkbcommon
    vulkan-loader
    wayland
    libGL
    gtk3
    glib
    cairo
    pango
    gdk-pixbuf
    fontconfig
    freetype
    atk
    at-spi2-atk
    dbus
    libayatana-appindicator
    libx11
    libxcursor
    libxrandr
    libxi
    libxext
    libxfixes
    libxrender
    libxcomposite
    libxdamage
    libxinerama
  ];

  runtimeDependencies = [
    vulkan-loader
    wayland
    libGL
    libayatana-appindicator
  ];

  installPhase = ''
    runHook preInstall

    cd FluxDown-*

    mkdir -p $out/bin $out/share/applications $out/share/icons/hicolor/256x256/apps

    # Install binaries
    for f in fluxdown-desktop fluxdown-agent fluxdownd fluxdown_nmh flux_down; do
      if [ -f "$f" ]; then
        cp "$f" $out/bin/
        chmod +x "$out/bin/$f"
      fi
    done

    # Symlink main application binary to package name
    ln -sf $out/bin/fluxdown-desktop $out/bin/fluxdown

    # Install desktop entry and icon
    install -m 644 com.fluxdown.app.desktop $out/share/applications/com.fluxdown.app.desktop
    install -m 644 com.fluxdown.app.png $out/share/icons/hicolor/256x256/apps/com.fluxdown.app.png

    runHook postInstall
  '';

  meta = with lib; {
    description = "Rust-driven multi-protocol download manager supporting HTTP/FTP/BitTorrent & HLS/DASH streaming";
    homepage = "https://github.com/zerx-lab/FluxDown";
    license = licenses.gpl3Only;
    platforms = [ "x86_64-linux" ];
    mainProgram = "fluxdown-desktop";
  };
}
