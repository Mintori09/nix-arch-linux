#!/usr/bin/env bash
set -euo pipefail

# Khai báo danh sách các package dạng: "Name|NixFile|GitHubRepo|URLPattern"
PACKAGES=(
	"anyflip-downloader|$HOME/.config/home-manager/modules/packages/anyflip-downloader.nix|Lofter1/anyflip-downloader|https://github.com/{repo}/releases/download/v{version}/anyflip-downloader_{version}_linux_amd64.tar.gz"
	"dbx|$HOME/.config/home-manager/modules/packages/dbx.nix|t8y2/dbx|https://github.com/{repo}/releases/download/v{version}/DBX_{version}_amd64.deb"
	"zap|$HOME/.config/home-manager/modules/packages/zap.nix|zerx-lab/zap|https://github.com/{repo}/releases/download/v{version}/zap_{version}_amd64.deb"
)

update_pkg() {
	local name="$1" nix_file="$2" repo="$3" url_pattern="$4"

	local current="none"
	if [ -f "$nix_file" ]; then
		current=$(grep 'version = "' "$nix_file" | cut -d'"' -f2 || echo "none")
	fi

	local latest
	latest=$(curl -sL "https://api.github.com/repos/${repo}/releases/latest" | jq -r '.tag_name' | sed 's/^v//')

	if [ -z "$latest" ] || [ "$latest" = "null" ]; then
		echo "⚠️ Không lấy được phiên bản mới nhất cho $name từ GitHub"
		return 1
	fi

	if [ "$latest" = "$current" ]; then
		echo "✅ $name đã ở phiên bản mới nhất (v$latest)"
		return 0
	fi

	echo "🔄 Đang cập nhật $name: v$current → v$latest"

	local url
	url=$(echo "$url_pattern" | sed "s/{version}/$latest/g" | sed "s|{repo}|$repo|g")

	local tmp_file=""
	tmp_file=$(mktemp)
	trap 'rm -f "$tmp_file"' RETURN EXIT

	curl -sL -o "$tmp_file" "$url"
	local hash
	hash=$(nix hash file "$tmp_file" --sri)

	sed -i "s/version = \".*\";/version = \"$latest\";/" "$nix_file"
	sed -i "s|hash = \"sha256-.*\";|hash = \"$hash\";|" "$nix_file"

	echo "✨ Đã cập nhật $nix_file (hash: $hash)"
}

TARGET="${1:-all}"

updated_any=false
for pkg in "${PACKAGES[@]}"; do
	IFS="|" read -r name nix_file repo url_pattern <<<"$pkg"
	if [ "$TARGET" = "all" ] || [ "$TARGET" = "$name" ]; then
		update_pkg "$name" "$nix_file" "$repo" "$url_pattern"
		updated_any=true
	fi
done

if [ "$updated_any" = false ]; then
	echo "❌ Không tìm thấy package '$TARGET'."
	echo "Danh sách các package khả dụng: anyflip-downloader, dbx, zap"
	exit 1
fi
