#!/bin/bash

set -e

SCRATCH_DIR="/tmp/my-scratchpads"

get_extension_by_type() {
    local type_label="$1"
    case "$type_label" in
        javascript) echo "js" ;;
        python) echo "py" ;;
        bash) echo "sh" ;;
        typescript) echo "ts" ;;
        ruby) echo "rb" ;;
        php) echo "php" ;;
        lua) echo "lua" ;;
        perl) echo "pl" ;;
        zsh) echo "zsh" ;;
        json) echo "json" ;;
        yaml) echo "yml" ;;
        toml) echo "toml" ;;
        xml) echo "xml" ;;
        html) echo "html" ;;
        css) echo "css" ;;
        markdown) echo "md" ;;
        *) echo "" ;;
    esac
}

get_shebang_by_extension() {
    local ext="$1"
    case "$ext" in
        sh | bash) echo "#!/bin/bash" ;;
        py | python) echo "#!/usr/bin/env python3" ;;
        js | node) echo "#!/usr/bin/env node" ;;
        rb | ruby) echo "#!/usr/bin/env ruby" ;;
        pl | perl) echo "#!/usr/bin/env perl" ;;
        ts | typescript) echo "#!/usr/bin/env bun" ;;
        lua) echo "#!/usr/bin/env lua" ;;
        php) echo "#!/usr/bin/env php" ;;
        zsh) echo "#!/bin/zsh" ;;
        *) echo "" ;;
    esac
}

detect_extension_from_content() {
    local content="$1"

    if command -v magika >/dev/null 2>&1; then
        local type_label
        type_label=$(echo "$content" | magika - --json 2>/dev/null | jq -r '.[0].output.ct_label // empty' 2>/dev/null || echo "")
        if [[ -n "$type_label" && "$type_label" != "null" ]]; then
            get_extension_by_type "$type_label"
            return
        fi
    fi

    if [[ "$content" =~ "<html" || "$content" =~ "<!DOCTYPE html" ]]; then
        echo "html"
        return
    fi

    if command -v file >/dev/null 2>&1; then
        local file_ext
        file_ext=$(echo "$content" | file --brief --extension - | cut -d'/' -f1)
        [[ "$file_ext" != "???" ]] && echo "$file_ext"
    fi
}

apply_executable_environment() {
    local file_path="$1"
    local extension="$2"
    local shebang
    shebang=$(get_shebang_by_extension "$extension")

    [[ -z "$shebang" ]] && return

    if ! head -1 "$file_path" | grep -q "^#!"; then
        local temp_file
        temp_file=$(mktemp)
        echo "$shebang" >"$temp_file"
        echo "" >>"$temp_file"
        cat "$file_path" >>"$temp_file"
        mv "$temp_file" "$file_path"
    fi

    chmod +x "$file_path"
}

is_stdin_present() {
    [ -p /dev/stdin ] || [ ! -t 0 ]
}

persist_scratchpad() {
    local source_path="$1"
    local original_filename="$2"
    local extension="$3"

    if [[ ! -s "$source_path" ]]; then
        return
    fi

    echo ""
    read -p "Save scratch file to current directory? [y/N]: " response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        local destination="./$(basename "$source_path")"
        if [[ -e "$destination" ]]; then
            destination="./${original_filename}-$(date +%s).${extension}"
        fi
        cp "$source_path" "$destination"
        echo "Saved to: $destination"
    fi
}

main() {
    mkdir -p "$SCRATCH_DIR"

    local timestamp
    timestamp=$(date +%Y%m%d-%H%M%S)
    local extension=""
    local base_filename="scratch-$timestamp"
    local scratch_path=""

    if is_stdin_present; then
        local content
        content=$(cat)

        if [[ -n "$1" ]]; then
            extension="$1"
        else
            extension=$(detect_extension_from_content "$content")
        fi

        if [[ -n "$extension" ]]; then
            scratch_path="${SCRATCH_DIR}/${base_filename}.${extension}"
        else
            scratch_path="${SCRATCH_DIR}/${base_filename}"
        fi

        echo "$content" >"$scratch_path"
        [[ -n "$extension" ]] && apply_executable_environment "$scratch_path" "$extension"
    else
        extension="${1:-sh}"
        base_filename="${2:-scratch-$timestamp}"
        scratch_path="${SCRATCH_DIR}/${base_filename}.${extension}"

        local shebang
        shebang=$(get_shebang_by_extension "$extension")
        if [[ -n "$shebang" ]]; then
            echo "$shebang" >"$scratch_path"
            echo "" >>"$scratch_path"
            chmod +x "$scratch_path"
        else
            touch "$scratch_path"
        fi
    fi

    trap 'persist_scratchpad "$scratch_path" "$base_filename" "$extension"; rm -f "$scratch_path"' EXIT INT TERM HUP

    ${EDITOR:-vim} "$scratch_path"
}

main "$@"
