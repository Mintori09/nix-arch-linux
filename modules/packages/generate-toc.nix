{ pkgs, ... }:

let
  pythonEnv = pkgs.python3.withPackages (ps: with ps; [ python-docx ]);

  zshCompletion = ''
    #compdef gentoc
    _arguments \
      '1:target file:_files -g "*.md *.docx"'
  '';
in
pkgs.stdenv.mkDerivation {
  pname = "generate-toc";
  version = "1.0.0";

  src = ../../packages/generate-toc;

  nativeBuildInputs = [ pkgs.makeWrapper ];

  installPhase = ''
    mkdir -p $out/bin $out/share/zsh/site-functions
    makeWrapper ${pythonEnv}/bin/python $out/bin/gentoc \
      --add-flags "$src/generate_toc.py"

    cat <<'EOF' > $out/share/zsh/site-functions/_gentoc
    ${zshCompletion}
    EOF
  '';

  meta = with pkgs.lib; {
    description = "Generate table of contents for markdown and docx documents";
    mainProgram = "gentoc";
    platforms = platforms.linux;
  };
}
