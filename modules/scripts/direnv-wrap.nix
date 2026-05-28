{ ... }:
let
  script = builtins.readFile ../../scripts/execute/dev-templates.zsh;
in
{
  programs.zsh.initContent = ''
    ${script}
  '';
}
