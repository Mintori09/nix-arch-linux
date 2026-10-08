{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };

  aiRenamerCompletion = pkgs.writeTextFile {
    name = "ai-renamer-zsh-completion";
    destination = "/share/zsh/site-functions/_ai-renamer";
    text = builtins.readFile ./completions/_ai-renamer;
  };
in
{
  home.packages =
    (helpers.mkScriptPackage {
      name = "ai-renamer";
      entry = "${../../scripts/execute/ai-renamer.ts}";
    })
    ++ [ aiRenamerCompletion ];
}
