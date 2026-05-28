{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "sleep-cycles";
    runtime = "${pkgs.tsx}/bin/tsx";
    entry = "${../../scripts/execute/sleep-cycles.ts}";
  };
}
