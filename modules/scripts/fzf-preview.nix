{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "preview";
    runtime = "${pkgs.bash}/bin/bash";
    entry = "${../../scripts/execute/fzf-preview.sh}";
  };
}
