#!/bin/bash

# Scratchpad manager script
# Usage: scratch <extension> [filename]
# Examples: scratch sh, scratch py, scratch js mytest

set -e

# Configuration
SCRATCH_DIR="/tmp/my-scratchpads"
EXTENSION="${1:-sh}"
FILENAME="${2:-scratch-$(date +%Y%m%d-%H%M%S)}"
SCRATCH_FILE="${SCRATCH_DIR}/${FILENAME}.${EXTENSION}"

# Ensure scratch directory exists
mkdir -p "$SCRATCH_DIR"

# Determine shebang based on extension
get_shebang() {
    case "$1" in
        sh | bash) echo "#!/bin/bash" ;;
        py | python) echo "#!/usr/bin/env python3" ;;
        js | node) echo "#!/usr/bin/env node" ;;
        rb | ruby) echo "#!/usr/bin/env ruby" ;;
        pl | perl) echo "#!/usr/bin/env perl" ;;
        ts | typescript) echo "#!/usr/bin/env bun" ;;
        lua) echo "#!/usr/bin/env lua" ;;
        php) echo "#!/usr/bin/env php" ;;
        zsh) echo "#!/bin/zsh" ;;
        fish) echo "#!/usr/bin/env fish" ;;
        *) echo "#!/bin/bash" ;;
    esac
}

# Create scratch file with shebang
SHEBANG=$(get_shebang "$EXTENSION")
echo "$SHEBANG" >"$SCRATCH_FILE"

# Add empty line after shebang for better editing
echo "" >>"$SCRATCH_FILE"

# Set executable permission
chmod +x "$SCRATCH_FILE"

# Cleanup function
cleanup() {
    local exit_code=$?

    # Only prompt to save if file was modified (has content beyond shebang)
    if [ -s "$SCRATCH_FILE" ] && [ "$(wc -l <"$SCRATCH_FILE")" -gt 2 ] 2>/dev/null; then
        echo ""
        read -p "Save scratch file to current directory? [y/N]: " response

        if [[ "$response" =~ ^[Yy]$ ]]; then
            local dest="./$(basename "$SCRATCH_FILE")"
            # Handle duplicate names
            if [ -e "$dest" ]; then
                dest="./$(basename "$SCRATCH_FILE" ".$EXTENSION")-$(date +%s).${EXTENSION}"
            fi
            cp "$SCRATCH_FILE" "$dest"
            echo "Saved to: $dest"
        fi
    fi

    # Always remove the scratch file
    rm -f "$SCRATCH_FILE"
    exit $exit_code
}

# Set trap for various signals
trap cleanup EXIT INT TERM HUP

# Open editor
${EDITOR:-vim} "$SCRATCH_FILE"
