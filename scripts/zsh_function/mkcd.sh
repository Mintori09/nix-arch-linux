mkcd() {
    if [ -z "$1" ]; then
        echo "Error: Please add folder's name."
        return 1
    fi
    mkdir -p "$1" && cd "$1"
}
