#!/usr/bin/env bash
set -euo pipefail

# 1. Create a temporary image file to safely capture binary PNG stream (avoids bash stripping null-bytes)
TMP_IMG=$(mktemp --suffix=.png /tmp/lumine-img-XXXXXX)
trap 'rm -f "$TMP_IMG"' EXIT

# Capture selected region and write raw binary PNG directly into the temporary file
lumine-capture -r -t o > "$TMP_IMG" 2>/dev/null || true

# Exit gracefully if empty (e.g., user pressed Esc to cancel)
if [ ! -s "$TMP_IMG" ]; then
    exit 0
fi

# 2. Run OCR using tesseract (Japanese + English + Vietnamese)
TEXT=$(tesseract "$TMP_IMG" stdout -l jpn+eng+vie 2>/dev/null || true)

# Trim leading and trailing whitespace
TEXT="$(printf "%s" "$TEXT" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

if [ -z "$TEXT" ]; then
    notify-send -i lumine-capture -a "Lumine OCR" "Lumine OCR" "No text recognized."
    exit 0
fi

# 3. Copy recognized text to Wayland clipboard
printf "%s" "$TEXT" | wl-copy

# 4. Save text into a temporary file for the editor action
TMP_TXT=$(mktemp --suffix=.txt /tmp/ocr-text-XXXXXX)
printf "%s\n" "$TEXT" > "$TMP_TXT"

# Prepare a short preview for notification
PREVIEW=$(printf "%s" "$TEXT" | head -n 3)
if [ "$(printf "%s" "$TEXT" | wc -l)" -gt 3 ]; then
    PREVIEW="$PREVIEW..."
fi

# 5. Send notification with action button to open editor
ACTION=$(notify-send -i lumine-capture \
    -a "Lumine OCR" \
    -A "edit=Open in Editor" \
    "OCR Copied to Clipboard" \
    "$PREVIEW" 2>/dev/null || true)

if [ "$ACTION" = "edit" ]; then
    if command -v neovide >/dev/null 2>&1; then
        neovide "$TMP_TXT" &
    elif command -v kitty >/dev/null 2>&1; then
        kitty -e "${EDITOR:-nvim}" "$TMP_TXT" &
    elif command -v kate >/dev/null 2>&1; then
        kate "$TMP_TXT" &
    elif command -v kwrite >/dev/null 2>&1; then
        kwrite "$TMP_TXT" &
    else
        xdg-open "$TMP_TXT" &
    fi
fi
