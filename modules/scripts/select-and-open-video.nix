{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "vd";
    runtime = "${pkgs.deno}/bin/deno run -A";
    entry = "${../../scripts/execute/select-and-open-video.ts}";
  };
}
