{ pkgs, ... }:

pkgs.stdenv.mkDerivation {
  pname = "bookokrat";
  version = "0.3.12";

  src = pkgs.fetchurl {
    url = "https://github.com/bugzmanov/bookokrat/releases/download/v0.3.12/bookokrat-v0.3.12-x86_64-unknown-linux-gnu.tar.gz";
    hash = "sha256-+nCRo0gsAOcjoycUa10lZVkoK+eDrH4LgvS0CFY3YPM=";
  };

  sourceRoot = ".";

  installPhase = ''
    install -Dm755 bookokrat $out/bin/bookokrat
  '';

  meta = {
    description = "A terminal EPUB reader";
    homepage = "https://github.com/bugzmanov/bookokrat";
    license = pkgs.lib.licenses.mit;
    platforms = [ "x86_64-linux" ];
  };
}
