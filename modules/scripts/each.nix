{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };

  eachCompletion = pkgs.writeTextFile {
    name = "_each";
    destination = "/share/zsh/site-functions/_each";
    text = ''
      #compdef each

      _each() {
        local -a split_modes
        split_modes=(
          'line:split stdin by lines'
          'whitespace:split stdin by whitespace'
          'blank:split stdin by blank lines'
          'none:use whole stdin as one item'
        )

        _arguments \
          '--help[show help message]' \
          '--json[parse stdin as JSON array]' \
          '--split[choose stdin split mode]:split mode:->split_modes' \
          '--dry-run[print commands without executing]' \
          '--fail-fast[stop on first failed command]' \
          '--keep-empty[keep empty items]' \
          '--quiet[hide progress output]' \
          '1:command template:_command_names -e' \
          '*::command args:_normal'

        case $state in
          split_modes)
            _describe 'split mode' split_modes
            ;;
        esac
      }

      _each "$@"
    '';
  };
in
{
  home.packages =
    helpers.mkScriptPackage {
      name = "each";
      entry = "${../../scripts/execute/each.ts}";
    }
    ++ [
      eachCompletion
    ];
}
