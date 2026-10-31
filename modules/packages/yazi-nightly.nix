{ pkgs, ... }:

let
  version = "nightly-20261028";
in

pkgs.stdenv.mkDerivation {
  pname = "yazi";
  inherit version;

  src = pkgs.fetchurl {
    url = "https://github.com/sxyazi/yazi/releases/download/nightly/yazi-x86_64-unknown-linux-musl.zip";
    hash = "sha256-FUWtiJ9o/1qgeawQFaFteH8VHWBv3qPj0meGBge7joI=";
  };

  nativeBuildInputs = [ pkgs.unzip ];

  sourceRoot = "yazi-x86_64-unknown-linux-musl";

  installPhase = ''
    install -Dm755 yazi $out/bin/yazi
    install -Dm755 ya $out/bin/ya

    # Shell completions
    if [ -d completions ]; then
      [ -f completions/yazi.bash ] && install -Dm644 completions/yazi.bash $out/share/bash-completion/completions/yazi
      [ -f completions/ya.bash ] && install -Dm644 completions/ya.bash $out/share/bash-completion/completions/ya

      [ -f completions/_yazi ] && install -Dm644 completions/_yazi $out/share/zsh/site-functions/_yazi
      [ -f completions/_ya ] && install -Dm644 completions/_ya $out/share/zsh/site-functions/_ya

      [ -f completions/yazi.fish ] && install -Dm644 completions/yazi.fish $out/share/fish/vendor_completions.d/yazi.fish
      [ -f completions/ya.fish ] && install -Dm644 completions/ya.fish $out/share/fish/vendor_completions.d/ya.fish
    fi
  '';

  meta = with pkgs.lib; {
    description = "Blazing fast terminal file manager written in Rust, based on async I/O (Nightly build)";
    homepage = "https://github.com/sxyazi/yazi";
    license = licenses.mit;
    platforms = [ "x86_64-linux" ];
    mainProgram = "yazi";
  };
}
