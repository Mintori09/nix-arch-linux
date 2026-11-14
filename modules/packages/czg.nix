{ pkgs, ... }:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
in

pkgs.stdenv.mkDerivation {
  inherit (sources.czg) pname version src;

  sourceRoot = "package";

  nativeBuildInputs = [ pkgs.makeWrapper ];

  installPhase = ''
    runHook preInstall

    mkdir -p $out/lib/czg
    cp -r * $out/lib/czg/

    mkdir -p $out/bin
    makeWrapper ${pkgs.nodejs_22}/bin/node $out/bin/czg \
      --add-flags "$out/lib/czg/bin/index.js"

    ln -s czg $out/bin/git-czg

    runHook postInstall
  '';

  meta = with pkgs.lib; {
    description = "Interactive Commitizen CLI that generates standardized git commit messages";
    homepage = "https://cz-git.qbb.sh/cli/";
    license = licenses.mit;
    platforms = [ "x86_64-linux" ];
    mainProgram = "czg";
  };
}
