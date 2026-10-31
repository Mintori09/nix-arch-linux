{ pkgs, ... }:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
  inherit (sources.vicinae) pname version src;
in

pkgs.stdenv.mkDerivation {
  inherit pname version src;
  sourceRoot = ".";

  dontBuild = true;
  dontStrip = false;

  installPhase = ''
    runHook preInstall

    mkdir -p $out
    cp -r bin lib libexec share $out/

    # Ensure systemd user service directory exists in share
    if [ -d $out/lib/systemd/user ]; then
      mkdir -p $out/share/systemd/user
      cp -r $out/lib/systemd/user/* $out/share/systemd/user/
    fi

    # Bind binary dynamically to host C++ & Qt runtime on EndeavourOS / Arch
    for b in $out/bin/vicinae $out/libexec/vicinae/*; do
      if [ -f "$b" ] && [ -x "$b" ]; then
        patchelf --set-interpreter /lib64/ld-linux-x86-64.so.2 "$b" || true
        patchelf --set-rpath "/usr/lib:/usr/lib64" "$b" || true
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
