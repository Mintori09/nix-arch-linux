#!/bin/bash
# Script created on Wed  3 Dec 01:06:44 +07 2025

fzf-rg-edit() {
	local RG_PREFIX="rg --column --line-number --no-heading --color=always --smart-case "
	local INITIAL_QUERY="${*:-}"

	local result
	result=$(
		FZF_DEFAULT_COMMAND="$RG_PREFIX $(printf %q "$INITIAL_QUERY")" \
			fzf --ansi \
			--disabled --query "$INITIAL_QUERY" \
			--bind "change:reload:sleep 0.1; $RG_PREFIX {q} || true" \
			--delimiter : \
			--preview 'bat --color=always {1} --highlight-line {2}' \
			--preview-window 'up,60%,border-bottom,+{2}+3/3,~3'
	)

	if [[ -n "$result" ]]; then
		IFS=':' read -r -a selected <<<"$result"

		${EDITOR:-vim} "${selected[0]}" "+${selected[1]}"
	fi
}

fzf-rg-edit "$@"
