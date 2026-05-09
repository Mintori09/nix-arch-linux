{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };

  cpathCompletion = pkgs.writeTextFile {
    name = "cpath-zsh-completion";
    destination = "/share/zsh/site-functions/_cpath";
    text = ''
      #compdef cpath

      _cpath_has_flag() {
        local word target="$1"

        for word in ''${words[@]}; do
          if [[ "$word" == "$target" ]]; then
            return 0
          fi
        done

        return 1
      }

      _cpath_selector_glob() {
        local index
        local group
        local -a extensions

        for (( index = 1; index <= CURRENT; index++ )); do
          if [[ "''${words[index]}" != "--type" ]]; then
            continue
          fi

          group="''${words[index + 1]}"
          case "$group" in
            subtitles)
              extensions+=(srt vtt ass ssa sub)
              ;;
            images)
              extensions+=(jpg jpeg png webp gif bmp tiff svg)
              ;;
            text)
              extensions+=(txt md log)
              ;;
          esac
        done

        if (( ''${#extensions[@]} == 0 )); then
          return 1
        fi

        print -r -- "(#i)*.(''${(j:|:)extensions})"
      }

      _cpath_files() {
        local selector_glob

        if _cpath_has_flag --content; then
          selector_glob="$(_cpath_selector_glob 2>/dev/null)"
          if [[ -n "$selector_glob" ]]; then
            _files -g "$selector_glob"
            return
          fi

          _files
          return
        fi

        if _cpath_has_flag --all; then
          _alternative \
            'files:file:_files' \
            'directories:directory:_files -/'
          return
        fi

        selector_glob="$(_cpath_selector_glob 2>/dev/null)"
        if [[ -n "$selector_glob" ]]; then
          _alternative \
            "files:file:_files -g $selector_glob" \
            'directories:directory:_files -/'
          return
        fi

        _alternative \
          'files:file:_files' \
          'directories:directory:_files -/'
      }

      _cpath() {
        local -a args
        args=(
          '--separator[copy full paths with a custom separator; supports \n, \t, \r, \\]:separator string: '
          '--name-only[copy basename only instead of the full path]'
          '--quote[always wrap full paths in double quotes]'
          '--content[copy content with a path header for each file]'
          '--content-path-mode[path format for --content (only-name, fullpath, relative)]:mode:(only-name fullpath relative)'
          '--dry-run[show content that would be copied without actually copying]'
          '--home-relative[render paths under $HOME as ~/...]'
          '--recursive[search subdirectories for selector flags]'
          '--all[copy all files in the current directory scope as full paths]'
          '--type[copy files from a named group]:group:(images subtitles text)'
          '--random[randomly select N files to copy]:count:_guard "[0-9]#" "count"'
          '*:path:_cpath_files'
        )

        _arguments -S $args
      }

      compdef _cpath cpath
    '';
  };
in
{
  home.packages =
    (helpers.mkScriptPackage {
      name = "cpath";
      runtime = "${pkgs.bun}/bin/bun";
      entry = "${../../scripts/execute}/copy-files.ts";
      extraPathPackages = [
        pkgs.fd
      ];
    })
    ++ [ cpathCompletion ];
}
