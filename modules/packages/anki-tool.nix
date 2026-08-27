{ pkgs, ... }:

let
  runtimeDeps = with pkgs; [
    unzip
  ];
in
pkgs.stdenv.mkDerivation {
  pname = "anki-tool";
  version = "1.0.0";

  src = ../../packages/anki-generator-node;

  nativeBuildInputs = [ pkgs.makeWrapper ];

  installPhase = ''
    mkdir -p $out/bin $out/lib/anki-tool $out/share/zsh/site-functions
    cp dist/index.js $out/lib/anki-tool/anki-tool.js
    cp -r templates $out/lib/anki-tool/
    cp -r styles $out/lib/anki-tool/

    makeWrapper ${pkgs.nodejs_22}/bin/node $out/bin/anki-tool \
      --add-flags "$out/lib/anki-tool/anki-tool.js" \
      --prefix PATH : ${pkgs.lib.makeBinPath runtimeDeps} \
      --set ANKI_TOOL_ROOT "$out/lib/anki-tool"

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
