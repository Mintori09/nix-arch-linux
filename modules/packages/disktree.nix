{ pkgs, ... }:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
in

pkgs.stdenv.mkDerivation {
  inherit (sources.disktree) pname version src;

  nativeBuildInputs = [
    pkgs.autoPatchelfHook
  ];

  buildInputs = [
    pkgs.stdenv.cc.cc.lib
    pkgs.libxcb
    pkgs.libxkbcommon
    pkgs.wayland
    pkgs.vulkan-loader
    pkgs.libGL
  ];

  appendRunpaths = [
    "${pkgs.wayland}/lib"
    "${pkgs.vulkan-loader}/lib"
    "${pkgs.libGL}/lib"
  ];

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin $out/share/applications $out/share/icons/hicolor/scalable/apps
    install -m755 disktree $out/bin/disktree
    install -m644 disktree.svg $out/share/icons/hicolor/scalable/apps/disktree.svg

    sed -e "s|@BINDIR@|$out/bin|" -e "s|@VERSION@|$version|" \
      disktree.desktop.in > $out/share/applications/disktree.desktop
    chmod 644 $out/share/applications/disktree.desktop

    runHook postInstall
  '';

  meta = with pkgs.lib; {
    description = "Disk space treemap application";
    homepage = "https://github.com/tobi/disktree";
    license = licenses.mit;
    platforms = [ "x86_64-linux" ];
    mainProgram = "disktree";
  };
}
