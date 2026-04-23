{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "telepush";
    runtime = "${pkgs.bash}/bin/bash";
    entry = "${../../scripts/execute/telepush.sh}";
  };
}
