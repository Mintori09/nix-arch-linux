{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "preview";
    entry = "${../../scripts/execute/fzf-preview.ts}";
  };
}
