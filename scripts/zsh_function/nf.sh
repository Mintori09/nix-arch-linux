nf() {
    local file=$(fzf)
    [ -n "$file" ] && nvim "$file"
}
