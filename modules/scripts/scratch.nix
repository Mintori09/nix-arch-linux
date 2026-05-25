{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "temp";
    runtime = "${pkgs.tsx}/bin/tsx";
    entry = "${../../scripts/execute/scratch.ts}";
    extraPathPackages = [
      pkgs.bash
      # pkgs.magika
      pkgs.jq
      pkgs.coreutils
    ];
  };
}
