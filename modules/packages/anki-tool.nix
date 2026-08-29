{ pkgs, ... }:

let
  runtimeDeps = with pkgs; [
    unzip
    nodejs_22
  ];
  srcDir = "/home/mintori/.config/home-manager/packages/anki-generator-node";
in
pkgs.stdenv.mkDerivation {
  pname = "anki-tool";
  version = "1.0.0";

  src = ../../packages/anki-generator-node;

  nativeBuildInputs = [ pkgs.makeWrapper ];

  installPhase = ''
    mkdir -p $out/bin $out/share/zsh/site-functions

    makeWrapper ${pkgs.nodejs_22}/bin/node $out/bin/anki-tool \
      --add-flags "${srcDir}/dist/index.js" \
      --prefix PATH : ${pkgs.lib.makeBinPath runtimeDeps} \
      --set NODE_PATH "${srcDir}/node_modules" \
      --set ANKI_TOOL_ROOT "${srcDir}"

    if [ -f completions/_anki-tool ]; then
      cp completions/_anki-tool $out/share/zsh/site-functions/_anki-tool
    fi
  '';

  meta = with pkgs.lib; {
    description = "Generate Anki .apkg decks from structured JSON vocabulary, grammar, or MCQ data";
    mainProgram = "anki-tool";
    license = licenses.isc;
    platforms = platforms.linux;
  };
}
