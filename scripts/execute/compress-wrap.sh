#!/usr/bin/env bash
# compress-wrap.sh
# Simple, safe compression wrapper using the output filename extension.

set -u
set -o pipefail

PROGRAM_NAME="$(basename "$0")"

usage() {
    cat <<EOF
Usage:
  $PROGRAM_NAME [-f|--force] OUTPUT INPUT...

Examples:
  $PROGRAM_NAME project.zip src README.md
  $PROGRAM_NAME logs.tar.gz logs/
  $PROGRAM_NAME backup.7z Documents/
  $PROGRAM_NAME file.txt.gz file.txt
  $PROGRAM_NAME -f project.zip src/

Supported output extensions:
  .zip
  .tar
  .tar.gz, .tgz
  .tar.bz2, .tbz2
  .tar.xz, .txz
  .7z
  .gz
  .bz2
  .xz

Notes:
  .gz, .bz2, and .xz compress exactly one regular file.
  For multiple files or directories, use .zip, .tar.*, or .7z.

Options:
  -f, --force   overwrite output file if it already exists
  -h, --help    show this help
EOF
}

die() {
    printf 'Error: %s\n' "$*" >&2
    exit 1
}

need_cmd() {
    command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

find_7z() {
    if command -v 7z >/dev/null 2>&1; then
        printf '7z'
        return 0
    fi

    if command -v 7za >/dev/null 2>&1; then
        printf '7za'
        return 0
    fi

    return 1
}

detect_type() {
    case "$1" in
        *.tar.gz | *.tgz) printf 'tar.gz' ;;
        *.tar.bz2 | *.tbz2) printf 'tar.bz2' ;;
        *.tar.xz | *.txz) printf 'tar.xz' ;;
        *.zip) printf 'zip' ;;
        *.tar) printf 'tar' ;;
        *.7z) printf '7z' ;;
        *.gz) printf 'gz' ;;
        *.bz2) printf 'bz2' ;;
        *.xz) printf 'xz' ;;
        *) return 1 ;;
    esac
}

check_output_path() {
    local output="$1"
    local force="$2"
    local output_dir

    [ -n "$output" ] || die "output file is empty"

    output_dir="$(dirname "$output")"
    [ -d "$output_dir" ] || die "output directory does not exist: $output_dir"
    [ -w "$output_dir" ] || die "output directory is not writable: $output_dir"

    if [ -e "$output" ] && [ "$force" != "yes" ]; then
        die "output already exists: $output (use -f to overwrite)"
    fi

    if [ -d "$output" ]; then
        die "output path is a directory: $output"
    fi
}

check_inputs_exist() {
    local input

    [ "$#" -gt 0 ] || die "missing input files or directories"

    for input in "$@"; do
        [ -e "$input" ] || die "input does not exist: $input"
        [ "$input" != "." ] || die "refusing to compress current directory directly; use a named directory instead"
        [ "$input" != ".." ] || die "refusing to compress parent directory directly; use a named directory instead"

        case "$(basename -- "$input")" in
            -*)
                die "input names starting with '-' are not supported safely: $input"
                ;;
        esac
    done
}

check_output_not_in_inputs() {
    local output_abs input_abs input
    output_abs="$(realpath -m "$1")"

    shift
    for input in "$@"; do
        input_abs="$(realpath -m "$input")"

        if [ "$output_abs" = "$input_abs" ]; then
            die "output file cannot also be an input: $input"
        fi

        if [ -d "$input" ]; then
            case "$output_abs" in
                "$input_abs"/*)
                    die "output file cannot be created inside input directory: $input"
                    ;;
            esac
        fi
    done
}

check_single_regular_file() {
    [ "$#" -eq 1 ] || die "this format accepts exactly one input file"
    [ -f "$1" ] || die "this format accepts one regular file, not a directory: $1"
}

check_dependencies() {
    local type="$1"

    case "$type" in
        zip) need_cmd zip ;;
        tar | tar.gz | tar.bz2 | tar.xz)
            need_cmd tar
            ;;
        7z) find_7z >/dev/null || die "required command not found: 7z or 7za" ;;
        gz) need_cmd gzip ;;
        bz2) need_cmd bzip2 ;;
        xz) need_cmd xz ;;
        *) die "unsupported compression type: $type" ;;
    esac
}

remove_partial_output() {
    local output="$1"

    if [ -e "$output" ]; then
        rm -f -- "$output"
    fi
}

compress_archive() {
    local type="$1"
    local output="$2"
    shift 2

    case "$type" in
        zip)
            zip -r "$output" "$@"
            ;;
        tar)
            tar -cf "$output" -- "$@"
            ;;
        tar.gz)
            tar -czf "$output" -- "$@"
            ;;
        tar.bz2)
            tar -cjf "$output" -- "$@"
            ;;
        tar.xz)
            tar -cJf "$output" -- "$@"
            ;;
        7z)
            "$(find_7z)" a -- "$output" "$@"
            ;;
        *)
            die "internal error: unsupported archive type: $type"
            ;;
    esac
}

compress_single_file() {
    local type="$1"
    local output="$2"
    local input="$3"

    case "$type" in
        gz)
            gzip -c -- "$input" >"$output"
            ;;
        bz2)
            bzip2 -c -- "$input" >"$output"
            ;;
        xz)
            xz -c -- "$input" >"$output"
            ;;
        *)
            die "internal error: unsupported single-file type: $type"
            ;;
    esac
}

main() {
    local force="no"
    local output
    local type

    while [ "$#" -gt 0 ]; do
        case "$1" in
            -f | --force)
                force="yes"
                shift
                ;;
            -h | --help)
                usage
                exit 0
                ;;
            --)
                shift
                break
                ;;
            -*)
                die "unknown option: $1"
                ;;
            *)
                break
                ;;
        esac
    done

    [ "$#" -ge 2 ] || {
        usage >&2
        exit 1
    }

    output="$1"
    shift

    type="$(detect_type "$output")" || die "cannot detect compression type from output extension: $output"

    check_dependencies "$type"
    check_inputs_exist "$@"
    check_output_path "$output" "$force"
    check_output_not_in_inputs "$output" "$@"

    case "$type" in
        gz | bz2 | xz)
            check_single_regular_file "$@"
            ;;
    esac

    remove_partial_output "$output"

    if ! {
        case "$type" in
            zip | tar | tar.gz | tar.bz2 | tar.xz | 7z)
                compress_archive "$type" "$output" "$@"
                ;;
            gz | bz2 | xz)
                compress_single_file "$type" "$output" "$1"
                ;;
            *)
                die "unsupported compression type: $type"
                ;;
        esac
    } then
        remove_partial_output "$output"
        die "compression failed; partial output removed"
    fi

    printf 'Created: %s\n' "$output"
}

main "$@"
