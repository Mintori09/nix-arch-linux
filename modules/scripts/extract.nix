{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "extract";
    runtime = "${pkgs.bash}/bin/bash";
    entry = "${../../scripts/execute/extract-file.sh}";
    extraPackages = [
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
  };
}
