{ pkgs, ... }:

let
  version = "0.26.0";
in

pkgs.stdenv.mkDerivation {
  pname = "kmp-lsp";
  inherit version;

  src = pkgs.fetchurl {
    url = "https://github.com/Hessesian/kmp-lsp/releases/download/v\${version}/kmp-lsp-linux-x86_64.tar.gz";
    hash = "sha256-E9YLRHErp5GalGnGtNgmFbp6IpRnRq8DRb31r+5mz0w=";
  };

  sourceRoot = ".";

  installPhase = ''
    install -Dm755 kmp-lsp $out/bin/kmp-lsp
    install -Dm755 kmp-jar-indexer $out/bin/kmp-jar-indexer
  '';

  meta = with pkgs.lib; {
    description = "Fast, low-memory LSP server for Kotlin and Java, written in Rust";
    homepage = "https://github.com/Hessesian/kmp-lsp";
    license = licenses.mit;
    platforms = [ "x86_64-linux" ];
    mainProgram = "kmp-lsp";
  };
}
