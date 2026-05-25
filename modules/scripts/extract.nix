{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "extract";
    runtime = "${pkgs.deno}/bin/deno run -A";
    entry = "${../../scripts/execute/extract-file.ts}";
    extraPackages = [
      pkgs.gnutar
      pkgs.bzip2
      pkgs.gzip
      pkgs.unzip
      pkgs.p7zip
      pkgs.unrar
      pkgs.libarchive
      pkgs.binutils
    ];
  };
}
