{ pkgs, ... }:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
in

pkgs.stdenv.mkDerivation {
  inherit (sources.kmp-lsp) pname version src;

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
