{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "wf";
    runtime = "${pkgs.tsx}/bin/tsx";
    entry = "${../../scripts/execute/which_file.ts}";
  };
}
