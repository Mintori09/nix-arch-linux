{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "sleep-cycles";
    runtime = "${pkgs.deno}/bin/deno run -A";
    entry = "${../../scripts/execute/sleep-cycles.ts}";
  };
}
