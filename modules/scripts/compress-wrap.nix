{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
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
  };
}
