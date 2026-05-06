{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
  irpmCompletion = pkgs.writeTextFile {
    name = "irpm-zsh-completion";
    destination = "/share/zsh/site-functions/_irpm";
    text = ''
      #compdef irpm

      _irpm() {
        local -a commands
        commands=(
          'extract:extract RPM contents to a directory'
          'install:publish a managed user-level install'
          'remove:remove a managed install'
          'list:list managed installs'
        )

        local curcontext="$curcontext" state line

        if (( CURRENT == 2 )); then
          _describe 'command' commands
          return
        fi

        case "''${words[2]}" in
          extract)
            _arguments \
              '(-f --force)'{-f,--force}'[replace an existing extraction directory]' \
              '(-h --help)'{-h,--help}'[show help]' \
              '1:rpm file:_files -g "*.rpm"' \
              '2:destination:_files -/'
            ;;
          install)
            _arguments \
              '(-f --force)'{-f,--force}'[replace an existing managed install with the same id]' \
              '(-h --help)'{-h,--help}'[show help]' \
              '1:rpm file:_files -g "*.rpm"'
            ;;
          remove)
            _arguments \
              '(-h --help)'{-h,--help}'[show help]' \
              '1:install id:->install_ids'

            case "$state" in
              install_ids)
                local -a ids
                ids=("''${(@f)$(irpm list --ids 2>/dev/null)}")
                _describe 'install id' ids
                ;;
            esac
            ;;
          list)
            _arguments \
              '--ids[print install ids only]' \
              '(-h --help)'{-h,--help}'[show help]'
            ;;
        esac
      }

      compdef _irpm irpm
    '';
  };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "irpm";
    runtime = "${pkgs.bun}/bin/bun";
    entry = "${../../scripts/execute/install-rpm.ts}";
    extraPathPackages = [
      pkgs.rpm
      pkgs.cpio
    ];
  } ++ [ irpmCompletion ];
}
