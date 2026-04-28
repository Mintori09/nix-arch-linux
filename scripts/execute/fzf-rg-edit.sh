#!/usr/bin/env bash
set -u

fzf-rg-edit() {
    command -v rg >/dev/null || {
        echo "Missing dependency: rg" >&2
        return 1
    }

    command -v fzf >/dev/null || {
        echo "Missing dependency: fzf" >&2
        return 1
    }

    local rg_prefix
    rg_prefix='rg --column --line-number --no-heading --color=always --smart-case'

    local initial_query="${*:-}"
    local preview_cmd

    if command -v bat >/dev/null; then
        preview_cmd='bat --style=numbers --color=always --highlight-line {2} -- {1}'
    else
        preview_cmd='sed -n "$(( {2} > 5 ? {2} - 5 : 1 )),$(( {2} + 5 ))p" -- {1}'
    fi

    local result file line
    result="$(
        FZF_DEFAULT_COMMAND="$rg_prefix -- $(printf '%q' "$initial_query")" \
            fzf --ansi \
            --disabled \
            --query "$initial_query" \
            --bind "change:reload:$rg_prefix -- {q} || true" \
            --bind "enter:accept" \
            --delimiter ':' \
            --nth '4..' \
            --preview "$preview_cmd" \
            --preview-window 'up,60%,border-bottom,+{2}+3/3,~3'
    )" || return

    [[ -n "$result" ]] || return

    file="${result%%:*}"
    result="${result#*:}"
    line="${result%%:*}"

    [[ -n "$file" && -n "$line" ]] || return

    "${EDITOR:-vim}" "$file" "+$line"
}

fzf-rg-edit "$@"
