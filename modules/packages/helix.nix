{ pkgs, ... }:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
in

pkgs.stdenv.mkDerivation {
  inherit (sources.helix) pname version src;

  nativeBuildInputs = [
    pkgs.autoPatchelfHook
    pkgs.makeWrapper
  ];

  buildInputs = [
    pkgs.stdenv.cc.cc.lib
  ];

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin $out/lib/helix
    cp hx $out/lib/helix/hx
    chmod +x $out/lib/helix/hx
    cp -r runtime $out/lib/helix/runtime

    makeWrapper $out/lib/helix/hx $out/bin/hx \
      --set HELIX_RUNTIME $out/lib/helix/runtime

    install -Dm644 contrib/completion/hx.zsh $out/share/zsh/site-functions/_hx
    install -Dm644 contrib/completion/hx.bash $out/share/bash-completion/completions/hx.bash
    install -Dm644 contrib/completion/hx.fish $out/share/fish/vendor_completions.d/hx.fish

    runHook postInstall
  '';

  meta = with pkgs.lib; {
    description = "Post-modern modal text editor (gj1118 fork)";
    homepage = "https://github.com/gj1118/helix";
    license = licenses.mpl20;
    platforms = [ "x86_64-linux" ];
    mainProgram = "hx";
  };
}
