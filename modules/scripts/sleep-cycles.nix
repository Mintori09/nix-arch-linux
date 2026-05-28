{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "sleep-cycles";
    entry = "${../../scripts/execute/sleep-cycles.ts}";
  };
}
