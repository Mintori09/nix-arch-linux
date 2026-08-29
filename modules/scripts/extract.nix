{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };

  extractCompletion = pkgs.writeTextFile {
    name = "extract-zsh-completion";
    destination = "/share/zsh/site-functions/_extract";
    text = ''
      #compdef extract

      _extract() {
        _arguments \
          '-d[extract into target directory]:directory:_files -/' \
          '--dir[extract into target directory]:directory:_files -/' \
          '*:archive file:_files -g "*.tar.bz2" -g "*.tar.gz" -g "*.tar.xz" -g "*.tbz2" -g "*.tgz" -g "*.tar" -g "*.bz2" -g "*.gz" -g "*.zip" -g "*.7z" -g "*.rar" -g "*.Z" -g "*.rpm" -g "*.epub" -g "*.deb"'
      }

      compdef _extract extract
    '';
  };
in
{
  home.packages =
    (helpers.mkScriptPackage {
      name = "extract";
      entry = "${../../scripts/execute/extract-file.ts}";
      extraPathPackages = [
        pkgs.gnutar
        pkgs.bzip2
        pkgs.gzip
        pkgs.unzip
        pkgs.p7zip
        pkgs.unrar
        pkgs.libarchive
        pkgs.binutils
      ];
    })
    ++ [ extractCompletion ];
}
