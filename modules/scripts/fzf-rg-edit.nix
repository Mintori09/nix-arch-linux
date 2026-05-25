{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "rgf";
    runtime = "${pkgs.deno}/bin/deno run -A";
    entry = "${../../scripts/execute/fzf-rg-edit.ts}";
  };
}
