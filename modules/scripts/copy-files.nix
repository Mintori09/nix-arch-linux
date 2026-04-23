{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "cpath";
    runtime = "${pkgs.bun}/bin/bun";
    entry = "${../../scripts/execute/copy-files.ts}";
  };
}
