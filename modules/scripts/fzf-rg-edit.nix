{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "rgf";
    entry = "${../../scripts/execute/fzf-rg-edit.ts}";
  };
}
