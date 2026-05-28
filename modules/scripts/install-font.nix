{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "ifont";
    runtime = "${pkgs.tsx}/bin/tsx";
    entry = "${../../scripts/execute/install-font.ts}";
    extraPathPackages = [
      pkgs.rpm
      pkgs.zstd
      pkgs.cpio
      pkgs.file
    ];
  };
}
