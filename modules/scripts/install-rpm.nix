{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "irpm";
    runtime = "${pkgs.bun}/bin/bun";
    entry = "${../../scripts/execute/install-rpm.ts}";
    extraPathPackages = [
      pkgs.rpm
      pkgs.cpio
    ];
  };
}
