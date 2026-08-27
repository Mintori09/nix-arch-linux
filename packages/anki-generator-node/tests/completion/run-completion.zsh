#!/usr/bin/env zsh
# run-completion.zsh
# Captures zsh completion candidates for _anki_tool using the
# `_main_complete` + `compstate` approach (no pty needed).
#
# Usage:
#   zsh run-completion.zsh <word1> [word2 ...] -- <CURRENT_INDEX>
#
# Prints candidates one per line to stdout.
# The last argument after -- is the 1-based CURRENT word index.
#
# Example (completing after "--type "):
#   zsh run-completion.zsh node dist/index.js --type '' -- 4
#   vocab
#   grammar
#   mcq

setopt NO_GLOBAL_RCS

SCRIPT_DIR="${0:a:h}"
PROJECT_ROOT="${SCRIPT_DIR}/../.."

# ── Parse arguments ────────────────────────────────────────────────────────────
local -a words_in=()
local current_idx=1
local past_sep=0

for arg in "$@"; do
	if [[ $arg == "--" ]]; then
		past_sep=1
		continue
	fi
	if ((past_sep)); then
		current_idx="$arg"
	else
		words_in+=("$arg")
	fi
done

if ((${#words_in} == 0)); then
	echo "Usage: $0 <word1> [word2...] -- <CURRENT_INDEX>" >&2
	exit 1
fi

# ── Run zsh inline with the completion infrastructure ────────────────────────
zsh -c "
setopt NO_GLOBAL_RCS NO_GLOBAL_EXPORT
fpath=('$PROJECT_ROOT/completions' \$fpath)
autoload -Uz compinit && compinit -u 2>/dev/null
autoload -Uz _anki_tool

# Capture additions via compadd override
typeset -ga __results=()
function compadd() {
    local -a myargs=()
    local skip_next=0
    # Walk args: skip flags and their values, collect bare words
    for a in \"\$@\"; do
        if (( skip_next )); then
            skip_next=0
            continue
        fi
        case \"\$a\" in
            -[AJVXabdeFfgiklMnoOpqQrRsuUW]) skip_next=1 ;;
            --) break ;;
            -*) ;;
            *) myargs+=(\"\$a\") ;;
        esac
    done
    __results+=(\"\${myargs[@]}\")
    builtin compadd \"\$@\" 2>/dev/null || true
}

# Set required completion variables
words=($(printf '%s ' $(printf '%q ' "${words_in[@]}")))
CURRENT=$current_idx
BUFFER=\"\${words[*]}\"
CURSOR=\${#BUFFER}

# Invoke the completion function
_anki_tool 2>/dev/null

# Output results
print -l \"\${__results[@]}\" | grep -v '^$' | sort -u
"
