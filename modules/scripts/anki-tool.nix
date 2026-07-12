{ pkgs, ... }:

let
  helpers = import ./_helpers.nix { inherit pkgs; };

  ankiCompletion = pkgs.writeTextFile {
    name = "anki-tool-zsh-completion";
    destination = "/share/zsh/site-functions/_anki_tool";
    text = ''
      #compdef anki-tool

      _anki_tool_dynamic() {
        if command -v anki-tool >/dev/null 2>&1; then
          eval "$(anki-tool --autocomplete)"
        fi
      }

      _anki_tool_dynamic "$@"
    '';
  };

in
{
  home.packages = [ ankiCompletion ];
}
