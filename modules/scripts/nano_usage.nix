{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "nano-usage";
    runtime = "${pkgs.tsx}/bin/tsx";
    entry = "${../../scripts/execute/nano-usage.ts}";
  };
}
