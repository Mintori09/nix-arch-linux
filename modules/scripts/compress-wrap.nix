{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
  compressCompletion = pkgs.writeTextFile {
    name = "compress-zsh-completion";
    destination = "/share/zsh/site-functions/_compress_wrap";
    text = ''
      #compdef compress

      _compress_wrap() {
        _arguments -s -S \
          '(-f --force)'{-f,--force}'[overwrite output file if it already exists]' \
          '(-h --help)'{-h,--help}'[show help message]' \
          '1:output archive:_files -g "*.zip *.tar *.tar.gz *.tgz *.tar.bz2 *.tbz2 *.tar.xz *.txz *.7z *.gz *.bz2 *.xz(-.)"' \
          '*:input files or directories:_files'
      }

      compdef _compress_wrap compress
    '';
  };
in
{
  home.packages =
    (helpers.mkScriptPackage {
      name = "compress";
      entry = "${../../scripts/execute/compress-wrap.ts}";
      extraPathPackages = [
        pkgs.zip
        pkgs.gnutar
        pkgs.bzip2
        pkgs.gzip
        pkgs.p7zip
        pkgs.xz
      ];
    })
    ++ [ compressCompletion ];
}
