{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "wf";
    entry = "${../../scripts/execute/which_file.ts}";
  };
}
