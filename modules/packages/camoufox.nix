{
  pkgs,
  lib,
  stdenv,
  autoPatchelfHook,
  wrapGAppsHook3,
  unzip,
  patchelfUnstable,
  gtk3,
  adwaita-icon-theme,
  alsa-lib,
  dbus-glib,
  pango,
  cairo,
  atk,
  gdk-pixbuf,
  glib,
  fontconfig,
  freetype,
  dbus,
  curl,
  pciutils,
  libva,
  libglvnd,
  ffmpeg,
  pipewire,
  libxtst,
  libx11,
  libxcomposite,
  libxdamage,
  libxext,
  libxfixes,
  libxrandr,
  libxrender,
  libxcursor,
  libxi,
  libxcb,
  ...
}:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
  inherit (sources.camoufox) pname version src;
in

stdenv.mkDerivation {
  inherit pname version src;

  sourceRoot = ".";

  nativeBuildInputs = [
    autoPatchelfHook
    wrapGAppsHook3
    unzip
    patchelfUnstable
  ];

  buildInputs = [
    gtk3
    adwaita-icon-theme
    alsa-lib
    dbus-glib
    libxtst
    libx11
    libxcomposite
    libxdamage
    libxext
    libxfixes
    libxrandr
    libxrender
    libxcursor
    libxi
    libxcb
    pango
    cairo
    atk
    gdk-pixbuf
    glib
    fontconfig
    freetype
    dbus
    stdenv.cc.cc.lib
  ];

  runtimeDependencies = [
    curl
    pciutils
    libva.out
    libglvnd
    ffmpeg
    pipewire
  ];

  appendRunpaths = [
    "${pipewire}/lib"
    "${libglvnd}/lib"
  ];

  patchelfFlags = [ "--no-clobber-old-sections" ];

  installPhase = ''
        runHook preInstall

        mkdir -p $out/lib/camoufox $out/bin
        cp -r * $out/lib/camoufox/
        chmod +x $out/lib/camoufox/camoufox $out/lib/camoufox/camoufox-bin

        ln -s $out/lib/camoufox/camoufox $out/bin/camoufox

        # Desktop entry & icons
        mkdir -p $out/share/applications $out/share/icons/hicolor/128x128/apps
        if [ -f $out/lib/camoufox/browser/chrome/icons/default/default128.png ]; then
          cp $out/lib/camoufox/browser/chrome/icons/default/default128.png $out/share/icons/hicolor/128x128/apps/camoufox.png
        fi

        cat > $out/share/applications/camoufox.desktop <<DESKTOP
    [Desktop Entry]
    Version=1.0
    Name=Camoufox
    Comment=Anti-detect browser for web scraping and automation
    Exec=$out/bin/camoufox %U
    Icon=camoufox
    Terminal=false
    Type=Application
    MimeType=text/html;text/xml;application/xhtml+xml;application/vnd.mozilla.xul+xml;text/mml;x-scheme-handler/http;x-scheme-handler/https;
    StartupNotify=true
    Categories=Network;WebBrowser;
    DESKTOP

        runHook postInstall
  '';

  meta = with lib; {
    description = "Open source anti-detect browser built for web scraping & AI agents";
    homepage = "https://github.com/daijro/camoufox";
    license = licenses.mpl20;
    platforms = [ "x86_64-linux" ];
    mainProgram = "camoufox";
  };
}
