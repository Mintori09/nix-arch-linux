{ pkgs, ... }:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
in

pkgs.stdenv.mkDerivation {
  inherit (sources.omnidiff) pname version src;

  sourceRoot = ".";

  nativeBuildInputs = [
    pkgs.installShellFiles
  ];

  installPhase = ''
    runHook preInstall

    install -Dm755 omnidiff $out/bin/omnidiff

    # Generate and install shell completions
    installShellCompletion --cmd omnidiff \
      --bash <($out/bin/omnidiff util completions bash) \
      --fish <($out/bin/omnidiff util completions fish) \
      --zsh <($out/bin/omnidiff util completions zsh)

    # Generate and install man page
    $out/bin/omnidiff util man > omnidiff.1
    installManPage omnidiff.1

    runHook postInstall
  '';

  meta = with pkgs.lib; {
    description = "Fast, robust, accurate content-aware diffing";
    homepage = "https://github.com/ivankovic/omnidiff";
    license = licenses.agpl3Only;
    platforms = [ "x86_64-linux" ];
    mainProgram = "omnidiff";
  };
}
