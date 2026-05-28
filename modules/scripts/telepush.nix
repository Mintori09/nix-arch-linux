{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "telepush";
    runtime = "${pkgs.tsx}/bin/tsx";
    entry = "${../../scripts/execute/telepush.ts}";
  };
}
