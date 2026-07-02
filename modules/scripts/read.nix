{ pkgs, ... }:
{
  home.packages = [
    (pkgs.writeShellApplication {
      name = "rd";

      runtimeInputs = with pkgs; [
        file
        fx
        tabiew
        tdf
        python3Packages.markitdown
        bookokrat
        glow
        bat
        w3m
        sqlit-tui
      ];

      text = ''
        set -uo pipefail

        if [ $# -lt 1 ]; then
            echo "Usage: r <file_path>"
            echo "Example: r data.json"
            exit 1
        fi

        FILE="$1"

        if [ ! -f "$FILE" ]; then
            echo "Error: File '$FILE' does not exist."
            exit 1
        fi

        # Extract file extension and convert to lowercase
        EXT="''${FILE##*.}"
        EXT=$(echo "$EXT" | tr '[:upper:]' '[:lower:]')

        # If no clear extension, use mime-type for detection
        if [ "$EXT" = "$FILE" ]; then
            MIME=$(file --mime-type -b "$FILE" 2>/dev/null || echo "")
            case "$MIME" in
                "application/json") EXT="json" ;;
                "text/csv") EXT="csv" ;;
                "text/markdown") EXT="md" ;;
                "application/pdf") EXT="pdf" ;;
                "application/epub+zip") EXT="epub" ;;
            esac
        fi

        # Route to dedicated CLI/TUI based on format
        case "$EXT" in
            json|yaml|toml)
                if command -v fx >/dev/null 2>&1; then
                    fx "$FILE"
                else
                    bat "$FILE" 2>/dev/null || less -R "$FILE"
                fi
                ;;

            csv|tsv|xlsx|xls|ods)
                if command -v tw >/dev/null 2>&1; then
                    tw "$FILE"
                else
                    bat "$FILE" 2>/dev/null || less -R "$FILE"
                fi
                ;;

            epub)
                if command -v bookokrat >/dev/null 2>&1; then
                    bookokrat "$FILE"
                else
                    bat "$FILE" 2>/dev/null || less -R "$FILE"
                fi
                ;;

            pdf)
                if command -v tdf >/dev/null 2>&1; then
                    tdf "$FILE"
                else
                    echo "Error: No tdf found to read PDF."
                    exit 1
                fi
                ;;

            db)
                if command -v sqlit >/dev/null 2>&1; then
                    sqlit connect sqlite --file-path "$FILE"
                else
                    echo "Error: No packages found to read sqlite."
                    exit 1
                fi
                ;;

            docx|pptx)
                if command -v markitdown >/dev/null 2>&1; then
                    if command -v glow >/dev/null 2>&1; then
                        markitdown "$FILE" | glow -
                    else
                        markitdown "$FILE" | (bat 2>/dev/null || less -R)
                    fi
                else
                    echo "Error: 'markitdown' is required to read this format."
                    exit 1
                fi
                ;;

            html|xml)
                if command -v w3m >/dev/null 2>&1; then
                    w3m -dump "$FILE" | (bat 2>/dev/null || less -R)
                else
                    bat "$FILE" 2>/dev/null || less -R "$FILE"
                fi
                ;;

            md|rst|txt|*)
                if command -v glow >/dev/null 2>&1; then
                    glow "$FILE"
                else
                    bat "$FILE" 2>/dev/null || less -R "$FILE"
                fi
                ;;
        esac
      '';
    })
  ];
}
