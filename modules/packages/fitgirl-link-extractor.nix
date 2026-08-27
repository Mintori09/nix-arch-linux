{ pkgs, ... }:

let
  pythonEnv = pkgs.python3.withPackages (
    ps: with ps; [
      aiohttp
      beautifulsoup4
      colorama
      playwright
    ]
  );
in
pkgs.stdenv.mkDerivation {
  pname = "fitgirl-link-extractor";
  version = "1.0.0";

  src = ../../packages/fitgirl-link-extractor;

  nativeBuildInputs = [ pkgs.makeWrapper ];

  installPhase = ''
    mkdir -p $out/bin $out/share/zsh/site-functions
    makeWrapper ${pythonEnv}/bin/python $out/bin/mle \
      --add-flags "$src/main.py" \
      --set PLAYWRIGHT_BROWSERS_PATH "${pkgs.playwright-driver.browsers}" \
      --set PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS "true"

    if [ -f _mle ]; then
      cp _mle $out/share/zsh/site-functions/_mle
    fi
  '';

  meta = with pkgs.lib; {
    description = "Multi-link extractor for FitGirl repacks";
    mainProgram = "mle";
    platforms = platforms.linux;
  };
}
