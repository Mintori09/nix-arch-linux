#!/usr/bin/env zsh
# Test _sh completion for `bash <Tab>` (depth 1) and `bash **<Tab>` (recursive)

set -euo pipefail

zmodload zsh/zpty zsh/datetime

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Setup fixture files
touch "$TMP_DIR/top.sh"
touch "$TMP_DIR/not_a_script.txt"
printf '#!/usr/bin/env bash\necho ok\n' > "$TMP_DIR/exec_script"
chmod +x "$TMP_DIR/exec_script"
mkdir -p "$TMP_DIR/sub"
touch "$TMP_DIR/sub/nested.sh"

COMP_DIR="${0:A:h:h}/modules/scripts/completions"

run_comp_test() {
  local input="$1"
  local label="$2"
  local out=""

  TERM=xterm-256color zpty -b test_zsh "zsh -f"
  zpty -w test_zsh "bindkey -e"
  zpty -w test_zsh "setopt menu_complete"
  zpty -w test_zsh "fpath=($COMP_DIR \$fpath)"
  zpty -w test_zsh "autoload -Uz compinit && compinit -u"
  zpty -w test_zsh "compdef _sh bash"
  zpty -w test_zsh "cd ${(q)TMP_DIR}"
  zpty -w test_zsh "printf '__RDY_%s__\n' 1"
  # Wait for startup + compinit to finish
  local chunk=""
  local ready_deadline=$(( EPOCHSECONDS + 5 ))
  while (( EPOCHSECONDS < ready_deadline )); do
    if zpty -r -t test_zsh chunk; then
      out+="$chunk"
      [[ "$out" == *"__RDY_1__"* ]] && break
    else
      sleep 0.05
    fi
  done
  sleep 0.1
  while zpty -r -t test_zsh chunk; do :; done

  # Send command + Tab
  zpty -n -w test_zsh "$input"$'\t'
  # Wait up to 3 seconds for completion output
  local deadline=$(( EPOCHSECONDS + 3 ))
  out=""
  while (( EPOCHSECONDS < deadline )); do
    if zpty -r -t test_zsh chunk; then
      out+="$chunk"
    else
      [[ "$out" == *$'\n'* ]] && break
      sleep 0.05
    fi
  done

  zpty -d test_zsh
  print -r -- "$out"
}

echo "Running test 1: bash <Tab> (depth 1, no hang)..."
out1="$(run_comp_test "bash " "normal tab")"
if [[ "$out1" != *"top.sh"* || "$out1" != *"exec_script"* ]]; then
  echo "FAIL: expected top.sh and exec_script in output:"
  print -r -- "$out1"
  exit 1
fi
if [[ "$out1" == *"nested.sh"* ]]; then
  echo "FAIL: nested.sh should NOT appear on normal Tab (depth 1):"
  print -r -- "$out1"
  exit 1
fi
echo "PASS: bash <Tab> returned depth-1 scripts without hanging."

echo "Running test 2: bash **<Tab> (recursive)..."
out2="$(run_comp_test "bash **" "double-star tab")"
if [[ "$out2" != *"sub/nested.sh"* ]]; then
  echo "FAIL: expected sub/nested.sh in output:"
  print -r -- "$out2"
  exit 1
fi
echo "PASS: bash **<Tab> returned nested.sh."
