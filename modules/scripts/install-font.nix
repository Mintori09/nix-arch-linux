{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "ifont";
    entry = "${../../scripts/execute/install-font.ts}";
    extraPathPackages = [
      pkgs.rpm
      pkgs.zstd
      pkgs.cpio
      pkgs.file
    ];
  };
}
