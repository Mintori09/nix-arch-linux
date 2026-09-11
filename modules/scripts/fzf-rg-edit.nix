{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };

  rgfCompletion = pkgs.writeTextFile {
    name = "rgf-zsh-completion";
    destination = "/share/zsh/site-functions/_rgf";
    text = ''
      #compdef rgf

      _arguments -s -S '*:target:_files'
    '';
  };
in
{
  home.packages =
    (helpers.mkScriptPackage {
      name = "rgf";
      entry = "${../../scripts/execute/fzf-rg-edit.ts}";
    })
    ++ [ rgfCompletion ];
}

