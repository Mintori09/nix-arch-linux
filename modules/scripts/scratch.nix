{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "temp";
    entry = "${../../scripts/execute/scratch.ts}";
    extraPathPackages = [
      pkgs.bash
      # pkgs.magika
      pkgs.jq
      pkgs.coreutils
    ];
  };
}
