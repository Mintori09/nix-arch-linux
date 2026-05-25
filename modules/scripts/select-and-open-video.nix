{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "vd";
    runtime = "${pkgs.tsx}/bin/tsx";
    entry = "${../../scripts/execute/select-and-open-video.ts}";
  };
}
