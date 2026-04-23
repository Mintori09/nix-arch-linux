{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "wf";
    runtime = "${pkgs.bun}/bin/bun";
    entry = "${../../scripts/execute/which_file.ts}";
  };
}
