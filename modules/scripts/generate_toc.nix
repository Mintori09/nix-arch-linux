{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkPythonScriptPackage {
    name = "gentoc";
    entry = "${../../scripts/execute/generate_toc.py}";
  };
}
