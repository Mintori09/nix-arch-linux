{ pkgs, ... }:

let
  version = "0.27.4";
in

pkgs.stdenv.mkDerivation {
  pname = "vicinae";
  inherit version;

  src = pkgs.fetchurl {
    url = "https://github.com/vicinaehq/vicinae/releases/download/v${version}/vicinae-linux-x86_64-v${version}.tar.gz";
    hash = "sha256-U3Rjx3NFBUwswAdUXr1/+khT+W7TQXaMOEmi2dNxWqg=";
  };

  sourceRoot = ".";

  nativeBuildInputs = [
    pkgs.patchelf
    pkgs.kdePackages.wrapQtAppsHook
  ];

  buildInputs = with pkgs; [
    gcc16.cc.lib
    kdePackages.qtbase
    kdePackages.qtdeclarative
    kdePackages.qtsvg
    kdePackages.qtwayland
    kdePackages.layer-shell-qt
    kdePackages.syntax-highlighting
    kdePackages.qtkeychain
    libqalculate
    wayland
    libxkbcommon
    libxcb
    libxcb-keysyms
    libxml2
    mpfr
    gmp
    openssl
    curl
    icu
    libGL
    systemdLibs
  ];

  installPhase = ''
    runHook preInstall
    mkdir -p $out
    cp -r bin libexec share lib include $out/

    for f in $out/bin/* $out/libexec/vicinae/*; do
      if [ -f "$f" ] && [ -x "$f" ]; then
        patchelf --set-rpath "$out/lib:/usr/lib:/usr/lib64" "$f" || true
      fi
    done

    runHook postInstall
  '';

  meta = with pkgs.lib; {
    description = "Focused, fast, and fully extensible application launcher for Linux";
    homepage = "https://github.com/vicinaehq/vicinae";
    license = licenses.gpl3Plus;
    platforms = [ "x86_64-linux" ];
    mainProgram = "vicinae";
  };
}
