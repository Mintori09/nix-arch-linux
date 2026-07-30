{ pkgs, ... }:

let
  version = "2026.07.09.1";
in

pkgs.stdenv.mkDerivation {
  pname = "zap";
  inherit version;

  src = pkgs.fetchurl {
    url = "https://github.com/zerx-lab/zap/releases/download/v${version}/zap_${version}_amd64.deb";
    hash = "sha256-CMGi5KV1pd4BKPeFwSUKtBdcFQzrTWYJ0bOxZAUZ6oI=";
  };

  dontUnpack = true;

  nativeBuildInputs = [ pkgs.zstd ];

  installPhase = ''
    ar x $src
    unzstd < data.tar.zst | tar xf -

    mkdir -p $out/bin $out/share
    cp opt/zap/zap-oss $out/bin/zap
    cp -r usr/share/applications $out/share/
    cp -r usr/share/icons $out/share/
  '';

  meta = with pkgs.lib; {
    description = "Open, local-first terminal with first-class AI and agent support";
    homepage = "https://github.com/zerx-lab/zap";
    license = licenses.agpl3Only;
    platforms = [ "x86_64-linux" ];
    mainProgram = "zap";
  };
}
