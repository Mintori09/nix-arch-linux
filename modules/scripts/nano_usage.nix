{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "nano-usage";
    entry = "${../../scripts/execute/nano-usage.ts}";
  };
}
