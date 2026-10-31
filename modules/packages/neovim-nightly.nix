{ pkgs, ... }:

let
  pname = "neovim";
  version = "nightly-20261031";

  src = pkgs.fetchurl {
    url = "https://github.com/neovim/neovim/releases/download/nightly/nvim-linux-x86_64.appimage";
    hash = "sha256-AYSPMEuqq37ZexgU4P5lneUgVUigOf6Ocj8Db9LoFtM=";
  };

  appimageContents = pkgs.appimageTools.extract { inherit pname version src; };
in

pkgs.appimageTools.wrapType2 {
  inherit pname version src;

  extraInstallCommands = ''
    ln -s $out/bin/${pname} $out/bin/nvim
    desktop_file=$(find ${appimageContents} -maxdepth 1 -name "*.desktop" | head -n 1)
    if [ -n "$desktop_file" ]; then
      install -m 444 -D "$desktop_file" $out/share/applications/nvim.desktop
      substituteInPlace $out/share/applications/nvim.desktop \
        --replace-fail 'Exec=nvim %F' "Exec=kitty -e $out/bin/nvim %F" \
        --replace-fail 'TryExec=nvim' "TryExec=$out/bin/nvim" \
        --replace-fail 'Terminal=true' 'Terminal=false'
    fi
    install -m 444 -D ${appimageContents}/nvim.png $out/share/icons/hicolor/128x128/apps/nvim.png
    install -m 444 -D ${appimageContents}/usr/share/man/man1/nvim.1 $out/share/man/man1/nvim.1
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
