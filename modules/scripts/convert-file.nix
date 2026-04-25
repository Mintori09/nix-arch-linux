{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
  cvCompletion = pkgs.writeTextFile {
    name = "cv-zsh-completion";
    destination = "/share/zsh/site-functions/_cv";
    text = ''
      #compdef cv

      _cv_normalize_ext() {
        local ext="$1"
        case "$ext" in
          jpeg) echo "jpg" ;;
          yml) echo "yaml" ;;
          *) echo "$ext" ;;
        esac
      }

      _cv_routes() {
        local line route in_ext out_ext

        while IFS= read -r line; do
          [[ "$line" == "- "*:* ]] || continue
          route=''${line#- }
          in_ext=''${route%%:*}
          out_ext=''${route##*:}
          in_ext=$(_cv_normalize_ext "''${in_ext:l}")
          out_ext=$(_cv_normalize_ext "''${out_ext:l}")
          print -r -- "''${in_ext}:''${out_ext}"
        done < <(
          cv --list 2>/dev/null | sed -E 's/\x1B\[[0-9;]*[mK]//g'
        )
      }

      _cv_collect_input_exts() {
        local line in_ext
        local -a input_exts
        typeset -A seen

        while IFS= read -r line; do
          in_ext=''${line%%:*}
          if [[ -n "$in_ext" && -z ''${seen[$in_ext]} ]]; then
            input_exts+=("$in_ext")
            seen[$in_ext]=1
          fi
        done < <(_cv_routes)

        if (( ''${#input_exts[@]} == 0 )); then
          return 1
        fi

        print -r -l -- ''${input_exts[@]}
      }

      _cv_collect_output_exts() {
        local input_ext="$1"
        local line in_ext out_ext
        local -a output_exts
        typeset -A seen

        while IFS= read -r line; do
          in_ext=''${line%%:*}
          out_ext=''${line##*:}
          if [[ "$in_ext" == "$input_ext" && -z ''${seen[$out_ext]} ]]; then
            output_exts+=("$out_ext")
            seen[$out_ext]=1
          fi
        done < <(_cv_routes)

        if (( ''${#output_exts[@]} == 0 )); then
          return 1
        fi

        print -r -l -- ''${output_exts[@]}
      }

      _cv() {
        local -a positional
        local i token current_word
        local positional_before=0
        local input_file input_ext
        local -a input_exts
        local input_glob
        local -a output_exts
        local input_name input_base output_dir
        local -a filename_candidates
        local -a typed_name_candidates

        current_word="''${words[CURRENT]}"

        if [[ "$current_word" == -* ]]; then
          compadd -- --list --dry-run
          return
        fi

        for (( i = 2; i <= ''${#words[@]}; i++ )); do
          token="''${words[i]}"
          [[ -z "$token" ]] && continue
          case "$token" in
            --list|--dry-run) ;;
            -*) ;;
            *) positional+=("$token") ;;
          esac
        done

        for (( i = 2; i < CURRENT; i++ )); do
          token="''${words[i]}"
          [[ -z "$token" ]] && continue
          case "$token" in
            --list|--dry-run) ;;
            -*) ;;
            *) (( positional_before++ )) ;;
          esac
        done

        if (( positional_before == 0 )); then
          compadd -- --list --dry-run

          if input_exts=($(_cv_collect_input_exts)); then
            input_glob="(#i)*.(''${(j:|:)input_exts})"
            _files -/ -g "$input_glob"
          else
            _files
          fi
          return
        fi

        input_file="''${positional[1]}"
        input_ext="''${input_file##*.}"
        [[ "$input_ext" == "$input_file" ]] && { _files; return; }
        input_ext=$(_cv_normalize_ext "''${input_ext:l}")

        if ! output_exts=($(_cv_collect_output_exts "$input_ext")); then
          _files
          return
        fi

        if [[ -z "$current_word" ]]; then
          input_name="''${input_file:t}"
          input_base="''${input_name%.*}"
          output_dir="''${input_file:h}"

          for token in ''${output_exts[@]}; do
            if [[ "$output_dir" == "." ]]; then
              filename_candidates+=("''${input_base}.''${token}")
            else
              filename_candidates+=("''${output_dir}/''${input_base}.''${token}")
            fi
          done
          compadd -Q -- ''${filename_candidates[@]}
          return
        fi

        if [[ "$current_word" == *.* ]]; then
          compset -P '*.'
          compadd -Q -- ''${output_exts[@]}
          return
        fi

        for token in ''${output_exts[@]}; do
          typed_name_candidates+=("''${current_word}.''${token}")
        done
        compadd -Q -- ''${typed_name_candidates[@]}
      }

      compdef _cv cv
    '';
  };
in
{
  home.packages =
    (helpers.mkScriptPackage {
      name = "cv";
      runtime = "${pkgs.bun}/bin/bun";
      entry = "${../../scripts/execute/convert-file.ts}";
      extraPathPackages = [
        pkgs.ffmpeg
        pkgs.imagemagick
        pkgs.pandoc
        pkgs.libreoffice
        pkgs.yq-go
        pkgs.python3Packages.weasyprint
      ];
    })
    ++ [ cvCompletion ];
}
