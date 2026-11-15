{ pkgs, ... }:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
in

pkgs.stdenv.mkDerivation {
  inherit (sources.pdfcpu) pname version src;

  sourceRoot = "pdfcpu_${sources.pdfcpu.version}_Linux_x86_64";

  nativeBuildInputs = [
    pkgs.installShellFiles
  ];

  installPhase = ''
    runHook preInstall

    install -Dm755 pdfcpu $out/bin/pdfcpu

    installShellCompletion --cmd pdfcpu \
      --bash <($out/bin/pdfcpu completion bash) \
      --fish <($out/bin/pdfcpu completion fish) \
      --zsh <($out/bin/pdfcpu completion zsh)

    runHook postInstall
  '';

  meta = with pkgs.lib; {
    description = "A PDF processor written in Go";
    homepage = "https://github.com/pdfcpu/pdfcpu";
    license = licenses.asl20;
    platforms = [ "x86_64-linux" ];
    mainProgram = "pdfcpu";
  };
}
