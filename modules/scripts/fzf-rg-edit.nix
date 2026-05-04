{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "rgf";
    runtime = "${pkgs.bash}/bin/bash";
    entry = "${../../scripts/execute/fzf-rg-edit.sh}";
  };
}
