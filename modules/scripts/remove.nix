{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };

  removeCompletion = pkgs.writeTextFile {
    name = "remove-zsh-completion";
    destination = "/share/zsh/site-functions/_remove";
    text = ''
      #compdef remove

      _remove() {
        local -a commands
        commands=(
          'subtitles:remove subtitle files'
          'images:remove image files'
          'text:remove text files'
        )

        local -A command_opts
        command_opts=(
          subtitles '
            -r[search in subdirectories]
            --recursive[search in subdirectories]
            -n[dry run, do not delete]
            --dry-run[dry run, do not delete]
            -h[show help]
            --help[show help]
          '
          images '
            -r[search in subdirectories]
            --recursive[search in subdirectories]
            -n[dry run, do not delete]
            --dry-run[dry run, do not delete]
            -h[show help]
            --help[show help]
          '
          text '
            -r[search in subdirectories]
            --recursive[search in subdirectories]
            -n[dry run, do not delete]
            --dry-run[dry run, do not delete]
            -h[show help]
            --help[show help]
          '
        )

        if (( CURRENT == 2 )); then
          _describe 'command' commands
          return
        fi

        local cmd="''${words[2]}"

        if [[ -n "''${command_opts[$cmd]}" ]]; then
          local -a opts
          opts=( ''${=command_opts[$cmd]} )
          _arguments -s $opts
        fi
      }

      compdef _remove remove
    '';
  };
in
{
  home.packages =
    (helpers.mkScriptPackage {
      name = "remove";
      runtime = "${pkgs.bun}/bin/bun";
      entry = "${../../scripts/execute}/remove.ts";
      extraPathPackages = [
        pkgs.fd
      ];
    })
    ++ [ removeCompletion ];
}
