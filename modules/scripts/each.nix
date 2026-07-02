{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };

  eachCompletion = pkgs.writeTextFile {
    name = "_each";
    destination = "/share/zsh/site-functions/_each";
    text = ''
      #compdef each

      _each() {
        _arguments \
          '--help[show help message]' \
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
          '--fail-fast[stop on first failed command]' \
          '--keep-empty[keep empty items]' \
          '--quiet[hide progress output]' \
          '1:command template:_command_names -e' \
          '*::command args:_normal'
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
