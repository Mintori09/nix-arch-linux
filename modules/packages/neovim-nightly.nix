{ pkgs, ... }:

pkgs.stdenv.mkDerivation {
  pname = "neovim";
  version = "nightly";

  src = pkgs.fetchurl {
    url = "https://github.com/neovim/neovim/releases/download/nightly/nvim-linux-x86_64.tar.gz";
    hash = "sha256-hwEKW6z3G3wBeSUjl8JWgZWRLL4Su8ma4IJoPLo+zYU=";
  };

  sourceRoot = "nvim-linux-x86_64";

  nativeBuildInputs = [
    pkgs.autoPatchelfHook
  ];

  buildInputs = [
    pkgs.stdenv.cc.cc.lib
  ];

  installPhase = ''
    runHook preInstall

    mkdir -p $out
    cp -r bin lib share $out/

    if [ -f "$out/share/applications/org.neovim.nvim.desktop" ]; then
      mv $out/share/applications/org.neovim.nvim.desktop $out/share/applications/nvim.desktop
      substituteInPlace $out/share/applications/nvim.desktop \
        --replace-fail 'Exec=nvim %F' "Exec=kitty -e $out/bin/nvim %F" \
        --replace-fail 'TryExec=nvim' "TryExec=$out/bin/nvim" \
        --replace-fail 'Terminal=true' 'Terminal=false'
    fi

    runHook postInstall
  '';

  meta = with pkgs.lib; {
    description = "Vim-fork focused on extensibility and usability (Nightly build)";
    homepage = "https://neovim.io";
    license = with licenses; [
      asl20
      vim
    ];
    platforms = [ "x86_64-linux" ];
    mainProgram = "nvim";
  };
}
