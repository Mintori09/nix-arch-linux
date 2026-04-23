{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "cv";
    runtime = "${pkgs.bun}/bin/bun";
    entry = "${../../scripts/execute/convert-file.ts}";
  };
}
