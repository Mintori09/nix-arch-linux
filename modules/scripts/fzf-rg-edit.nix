{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "rgf";
    runtime = "${pkgs.tsx}/bin/tsx";
    entry = "${../../scripts/execute/fzf-rg-edit.ts}";
  };
}
