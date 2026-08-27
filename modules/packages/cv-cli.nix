{ pkgs, ... }:

let
  runtimeDeps = with pkgs; [
    nodejs_22
    ffmpeg
    imagemagick
    pandoc
    python314Packages.markitdown
    libreoffice
    python3Packages.weasyprint
    chromium
    yq-go
    xlsx2csv
    poppler
    mermaid-cli
    jq
  ];
in
pkgs.stdenv.mkDerivation {
  pname = "cv-cli";
  version = "1.0.0";

  src = ../../packages/cv-cli;

  nativeBuildInputs = [ pkgs.makeWrapper ];

  installPhase = ''
    mkdir -p $out/bin $out/lib/cv $out/share/zsh/site-functions
    cp dist/index.js $out/lib/cv/index.js
    makeWrapper ${pkgs.nodejs_22}/bin/node $out/bin/cv \
      --add-flags "$out/lib/cv/index.js" \
      --prefix PATH : ${pkgs.lib.makeBinPath runtimeDeps}

    if [ -f completions/_cv ]; then
      cp completions/_cv $out/share/zsh/site-functions/_cv
    fi
  '';

  meta = with pkgs.lib; {
    description = "Modular CLI format converter tool using system binaries";
    mainProgram = "cv";
    license = licenses.mit;
    platforms = platforms.linux;
  };
}
