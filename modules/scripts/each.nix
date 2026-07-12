{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };

  eachCompletion = pkgs.writeTextFile {
    name = "_each";
    destination = "/share/zsh/site-functions/_each";
    text = ''
      #compdef each

      _each() {
        local -a _each_ph
        _each_ph=(
          "{}:quoted item value"
          "{raw}:raw item value"
          "{filename}:basename of item"
          "{stem}:basename without extension"
          "{ext}:extension with dot"
          "{kebab}:kebab-case of value"
          "{camel}:camelCase of value"
          "{pascal}:PascalCase of value"
          "{snake}:snake_case of value"
          "{lower}:lowercase of value"
          "{upper}:UPPERCASE of value"
          "{kebab-fn}:kebab-case of filename"
          "{camel-fn}:camelCase of filename"
          "{pascal-fn}:PascalCase of filename"
          "{snake-fn}:snake_case of filename"
          "{lower-fn}:lowercase of filename"
          "{upper-fn}:UPPERCASE of filename"
          "{kebab-stem}:kebab-case of stem"
          "{camel-stem}:camelCase of stem"
          "{pascal-stem}:PascalCase of stem"
          "{snake-stem}:snake_case of stem"
          "{lower-stem}:lowercase of stem"
          "{upper-stem}:UPPERCASE of stem"
          "{n}:1-based item number"
          "{number}:1-based item number (alias for {n})"
          "{i}:0-based item number"
          "{index}:0-based item number (alias for {i})"
          "{today}:current date YYYY-MM-DD"
          "{ipad}:0-based index zero-padded (auto-scaled)"
          "{indexpad}:alias for {ipad}"
          "{npad}:1-based number zero-padded (auto-scaled)"
          "{numberpad}:alias for {npad}"
        )

        _arguments \
          '(-h --help)'{-h,--help}'[show help message]' \
          '--json[parse stdin as JSON array]' \
          "--split[split mode or custom delimiter]:split mode:(${
            builtins.concatStringsSep " " [
              "line"
              "whitespace"
              "blank"
              "none"
              "tab"
              "backspace"
              "null"
              "newline"
              "space"
              "comma"
              "colon"
            ]
          })" \
          '--batch[run all items as a single command]' \
          '--batch=[run N items per command]:batch size' \
          '--parallel[run all items concurrently]' \
          '--parallel=[run at most N items concurrently]:concurrency limit' \
          '--print[print commands without executing]' \
          '--accept[prompt Y/n before running each command]' \
          '--fail-fast[stop on first failed command]' \
          '--keep-empty[keep empty items]' \
          '--quiet[hide progress output]' \
          '--' \
          '1:command template:->cmd' \
          '*::command args:->args'

        case $state in
          cmd)
            _alternative \
              "commands:command:_command_names -e" \
              "placeholders:placeholder:_describe -t placeholders placeholder _each_ph"
            ;;
          args)
            _alternative \
              "normal:argument:_default" \
              "placeholders:placeholder:_describe -t placeholders placeholder _each_ph"
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
