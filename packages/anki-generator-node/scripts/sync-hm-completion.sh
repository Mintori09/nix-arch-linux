#!/usr/bin/env bash
set -euo pipefail

# Lấy thư mục gốc của repository
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SRC_COMPLETION="$REPO_DIR/completions/_anki-tool"
HM_CONFIG_DIR="${HOME}/.config/home-manager"
HM_COMPLETION_DIR="$HM_CONFIG_DIR/modules/scripts/completions"
HM_DEST_COMPLETION="$HM_COMPLETION_DIR/_anki-tool"

# Màu sắc hiển thị
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[1;33m"
NC="\033[0m"

echo -e "${BLUE}==>${NC} Kiểm tra file completion nguồn: ${YELLOW}$SRC_COMPLETION${NC}"
if [ ! -f "$SRC_COMPLETION" ]; then
	echo "Lỗi: Không tìm thấy file $SRC_COMPLETION"
	exit 1
fi

echo -e "${BLUE}==>${NC} Copy _anki-tool vào Home Manager: ${YELLOW}$HM_DEST_COMPLETION${NC}"
mkdir -p "$HM_COMPLETION_DIR"
cp "$SRC_COMPLETION" "$HM_DEST_COMPLETION"

# Với Nix Flakes, các file mới cần được git theo dõi (add -N) để Nix nhìn thấy
if [ -d "$HM_CONFIG_DIR/.git" ]; then
	echo -e "${BLUE}==>${NC} Thêm file mới vào git index của Home Manager (git add -N)..."
	git -C "$HM_CONFIG_DIR" add -N "$HM_DEST_COMPLETION" 2>/dev/null || true
	if [ -d "$HM_CONFIG_DIR/modules/programs/agents/opencode/skills/doc-to-mcq" ]; then
		git -C "$HM_CONFIG_DIR" add -N "$HM_CONFIG_DIR/modules/programs/agents/opencode/skills/doc-to-mcq" 2>/dev/null || true
	fi
fi

echo -e "${GREEN}✓ Đã copy và track completion thành công!${NC}"

if command -v home-manager >/dev/null 2>&1; then
	echo -e "${BLUE}==>${NC} Tiến hành rebuild Home Manager..."
	home-manager switch --flake "$HM_CONFIG_DIR" -j 1
	echo -e "${GREEN}✓ Rebuild Home Manager thành công!${NC}"
else
	echo -e "${YELLOW}Cảnh báo: Không tìm thấy lệnh home-manager trong PATH, bỏ qua bước rebuild.${NC}"
fi
