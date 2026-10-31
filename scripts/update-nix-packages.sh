#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$HOME/.config/home-manager"
CONFIG_FILE="$REPO_DIR/nvfetcher.toml"
SOURCES_DIR="$REPO_DIR/modules/packages/_sources"

TARGET="${1:-all}"

echo "🚀 Bắt đầu kiểm tra và cập nhật packages qua nvfetcher..."

cd "$REPO_DIR"

if [ "$TARGET" = "all" ]; then
    nvfetcher -c "$CONFIG_FILE" -o "$SOURCES_DIR"
else
    nvfetcher -c "$CONFIG_FILE" -o "$SOURCES_DIR" -f "$TARGET"
fi

if ! git diff --quiet -- "$SOURCES_DIR"; then
    echo "📦 Đã phát hiện thay đổi trong sources. Đang chuẩn bị commit..."
    git add "$SOURCES_DIR"
    git commit -m "chore(packages): update nvfetcher generated sources"
    echo "🎉 Đã commit thành công!"
else
    echo "✅ Tất cả package đều ở phiên bản mới nhất!"
fi
