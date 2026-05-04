{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "temp";
    runtime = "${pkgs.bash}/bin/bash";
    entry = "${../../scripts/execute/scratch.sh}";
    extraPathPackages = [
      pkgs.bash
      pkgs.magika
      pkgs.jq
      pkgs.coreutils
    ];
  };
}
