{ pkgs, ... }:

let
  version = "0.1.0";
in
pkgs.stdenv.mkDerivation {
  pname = "keyboard-rs";
  inherit version;

  src = pkgs.fetchurl {
    url = "https://github.com/Mintori09/keyboard-serial/releases/download/v${version}/keyboard-rs-v${version}-x86_64-unknown-linux-gnu.tar.gz";
    hash = "sha256-EVtxId0ofbMUxZ4yvZmfqR+EDV3rbL+rV6/ufN2TXp0=";
  };

  sourceRoot = "keyboard-rs-v${version}-x86_64-unknown-linux-gnu";

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin $out/share/applications $out/lib/systemd/user

    install -Dm755 keyboard-rs $out/bin/keyboard-rs
    install -Dm755 keyboard-rs-config $out/bin/keyboard-rs-config

    if [ -f keyboard-rs-config.desktop ]; then
      install -Dm644 keyboard-rs-config.desktop $out/share/applications/keyboard-rs-config.desktop
    fi

    if [ -f keyboard-rs.service ]; then
      install -Dm644 keyboard-rs.service $out/lib/systemd/user/keyboard-rs.service
    fi

    runHook postInstall
  '';

  meta = with pkgs.lib; {
    description = "Serial macro daemon and GTK configurator for serial keyboards";
    homepage = "https://github.com/Mintori09/keyboard-serial";
    license = licenses.mit;
    platforms = [ "x86_64-linux" ];
    mainProgram = "keyboard-rs";
  };
}
