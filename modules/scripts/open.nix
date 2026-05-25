{ pkgs, ... }:
let
  inherit (pkgs) lib;
  helpers = import ./_helpers.nix { inherit pkgs; };

  optionalPkg =
    name:
    lib.optionals (builtins.hasAttr name pkgs) [
      (builtins.getAttr name pkgs)
    ];

  openCompletion = pkgs.writeTextFile {
    name = "open-zsh-completion";
    destination = "/share/zsh/site-functions/_open";
    text = ''
      #compdef open

      _open_has_project_flag() {
        local word

        for word in ''${words[@]}; do
          if [[ "$word" == "--project" || "$word" == "-p" ]]; then
            return 0
          fi
        done

        return 1
      }

      _open_targets() {
        if _open_has_project_flag; then
          _files -/
          return
        fi

        _files -/
      }

      _open() {
        local -a args
        args=(
          '(-p --project)'{-p,--project}'[open target as a Zed project]'
          '*:target:_open_targets'
        )

        _arguments -s -S $args
      }

      compdef _open open
    '';
  };
in
{
  home.packages =
    (helpers.mkScriptPackage {
      name = "open";
      runtime = "${pkgs.deno}/bin/deno run -A";
      entry = "${../../scripts/execute}/open.ts";
    })
    ++ [ openCompletion ];
}
