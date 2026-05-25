{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "compress";
    runtime = "${pkgs.deno}/bin/deno run -A";
    entry = "${../../scripts/execute/compress-wrap.ts}";
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
