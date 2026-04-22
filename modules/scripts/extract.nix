{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "extract" ''
    exec ${pkgs.bash}/bin/bash "${../../scripts/execute/extract-file.sh}" "$@"
  '';
in
{
  home.packages = [
    script
    pkgs.gnutar
    pkgs.bzip2
    pkgs.gzip
    pkgs.unzip
    pkgs.p7zip
    pkgs.unrar
    pkgs.ncompress
    pkgs.libarchive
    pkgs.binutils
  ];
}
