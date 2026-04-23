{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "mpvr";
    runtime = "${pkgs.bash}/bin/bash";
    entry = "${../../scripts/execute/mpvr.sh}";
  };
}
