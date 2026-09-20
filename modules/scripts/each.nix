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
          "}:Quoted item value (e.g. \"foo bar\")"
          "raw}:Raw unquoted value (e.g. foo bar)"
          "filename}:Basename (e.g. src/app.ts -> app.ts)"
          "stem}:Basename without extension (e.g. app.ts -> app)"
          "ext}:Extension with dot (e.g. app.ts -> .ts)"
          "kebab}:kebab-case (e.g. helloWorld -> hello-world)"
          "camel}:camelCase (e.g. hello_world -> helloWorld)"
          "pascal}:PascalCase (e.g. hello_world -> HelloWorld)"
          "snake}:snake_case (e.g. helloWorld -> hello_world)"
          "lower}:lowercase (e.g. HELLO -> hello)"
          "upper}:UPPERCASE (e.g. hello -> HELLO)"
          "kebab-fn}:kebab-case of filename (e.g. My File.TXT -> my-file.txt)"
          "camel-fn}:camelCase of filename (e.g. my-file.txt -> myFile.txt)"
          "pascal-fn}:PascalCase of filename (e.g. my-file.txt -> MyFile.txt)"
          "snake-fn}:snake_case of filename (e.g. my-file.txt -> my_file.txt)"
          "lower-fn}:lowercase of filename (e.g. FILE.TXT -> file.txt)"
          "upper-fn}:UPPERCASE of filename (e.g. file.txt -> FILE.TXT)"
          "kebab-stem}:kebab-case of stem (e.g. My File.txt -> my-file)"
          "camel-stem}:camelCase of stem (e.g. my-file.txt -> myFile)"
          "pascal-stem}:PascalCase of stem (e.g. my-file.txt -> MyFile)"
          "snake-stem}:snake_case of stem (e.g. my-file.txt -> my_file)"
          "lower-stem}:lowercase of stem (e.g. FILE.txt -> file)"
          "upper-stem}:UPPERCASE of stem (e.g. file.txt -> FILE)"
          "n}:1-based item number (e.g. 1, 2, 3)"
          "number}:1-based item number (alias for {n})"
          "i}:0-based item index (e.g. 0, 1, 2)"
          "index}:0-based item index (alias for {i})"
          "today}:Current date (e.g. 2026-09-20)"
          "ipad}:0-based zero-padded index (e.g. 01, 02...)"
          "indexpad}:0-based zero-padded index (alias for {ipad})"
          "npad}:1-based zero-padded number (e.g. 001, 002...)"
          "numberpad}:1-based zero-padded number (alias for {npad})"
        )

        local -a split_modes
        split_modes=(
          line whitespace blank none tab backspace null newline space comma colon
        )

        local cmd_idx=0
        local i=2

        while (( i < CURRENT )); do
          local w="$words[i]"
          if [[ "$w" == "--" ]]; then
            cmd_idx=$(( i + 1 ))
            break
          elif [[ "$w" == "--split" ]]; then
            (( i += 2 ))
            continue
          elif [[ "$w" == -* ]]; then
            (( i++ ))
            continue
          else
            cmd_idx=$i
            break
          fi
        done

        # If current token starts with { (each placeholder system)
        if [[ "$words[CURRENT]" == \{* ]]; then
          _describe -t placeholders "placeholder" _each_ph -Q -S ""
          return 0
        fi

        # If we are at or after the command
        if (( cmd_idx > 0 && CURRENT >= cmd_idx )); then
          if (( CURRENT == cmd_idx )); then
            _command_names -e
          else
            local -a orig_words
            orig_words=("''${(@)words}")
            local orig_current=$CURRENT
            shift $(( cmd_idx - 1 )) words
            (( CURRENT -= (cmd_idx - 1) ))
            _normal
            words=("''${(@)orig_words}")
            CURRENT=$orig_current
          fi
          return
        fi

        local -a opts
        opts=(
          '(-h --help)'{-h,--help}'[show help message]'
          '--json[parse stdin as JSON array]'
          '(--split)--split=[split mode or custom delimiter]:split mode:('"$split_modes"')'
          '(--split=)--split[split mode or custom delimiter]:split mode:('"$split_modes"')'
          '--batch[run all items as a single command]'
          '--batch=[run N items per command]:batch size'
          '--parallel[run all items concurrently]'
          '--parallel=[run at most N items concurrently]:concurrency limit'
          '--print[print commands without executing]'
          '--accept[prompt Y/n before running each command]'
          '--fail-fast[stop on first failed command]'
          '--keep-empty[keep empty items]'
          '--quiet[hide progress output]'
        )

        local ret=1
        if [[ "$PREFIX" == -* ]]; then
          _arguments -s -S $opts && ret=0
        else
          _arguments -s -S $opts && ret=0
          _command_names -e && ret=0
        fi
        return ret
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
