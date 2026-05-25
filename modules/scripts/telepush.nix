{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "telepush";
    runtime = "${pkgs.deno}/bin/deno run -A";
    entry = "${../../scripts/execute/telepush.ts}";
  };
}
