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
        local -a extensions

        _cpath_has_flag --subtitles && extensions+=(
          srt vtt ass ssa sub
        )
        _cpath_has_flag --images && extensions+=(
          jpg jpeg png webp gif bmp tiff svg
        )
        _cpath_has_flag --text && extensions+=(
          txt md log
        )

        if (( ''${#extensions[@]} == 0 )); then
          return 1
        fi

        print -r -- "(#i)*.(''${(j:|:)extensions})"
      }

      _cpath_files() {
        local selector_glob

        if _cpath_has_flag -C; then
          selector_glob="$(_cpath_selector_glob 2>/dev/null)"
          if [[ -n "$selector_glob" ]]; then
            _files -g "$selector_glob"
            return
          fi

          _files
          return
        fi

        if _cpath_has_flag --all; then
          _files -/
          return
        fi

        selector_glob="$(_cpath_selector_glob 2>/dev/null)"
        if [[ -n "$selector_glob" ]]; then
          _files -/ -g "$selector_glob"
          return
        fi

        _files -/
      }

      _cpath() {
        local -a args
        args=(
          '(-c -t -l)-c[copy paths separated by commas]'
          '(-c -t -l)-t[copy paths separated by tabs]'
          '(-c -t -l)-l[copy one path per line]'
          '-b[copy basename only]'
          '-q[always wrap paths in double quotes]'
          '-C[copy file contents instead of paths]'
          '(-H --home-relative)'{-H,--home-relative}'[render paths under $HOME as ~/...]'
          '(-R --recursive)'{-R,--recursive}'[search subdirectories for selector flags]'
          '--all[copy all files in the current directory scope]'
          '--subtitles[copy subtitle files]'
          '--images[copy image files]'
          '--text[copy text files]'
          '-r[randomly select N files to copy]:count:_guard "[0-9]#" "count"'
          '*:path:_cpath_files'
        )

        _arguments -s -S $args
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
