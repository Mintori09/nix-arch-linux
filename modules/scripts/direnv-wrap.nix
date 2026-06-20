{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
  script = builtins.readFile ../../scripts/execute/dev-templates.zsh;
in
{
  home.packages = helpers.mkScriptPackage {
    name = "direnv-wrap";
    entry = "${../../scripts/execute/direnv-wrap.ts}";
    extraPathPackages = [ pkgs.direnv ];
  };

  programs.zsh.initContent = ''
    ${script}
  '';
}
