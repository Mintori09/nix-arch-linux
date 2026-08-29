---
name: add-nix-github-package
description: >
  Automatically packages applications or CLI tools from GitHub Releases (AppImage,
  Debian .deb, tarball/tar.xz/tar.gz, prebuilt binary) into this Nix Home-Manager
  configuration, registers them into `flake.nix` overlay and `modules/packages.nix`,
  and configures auto-updating in `scripts/update-nix-packages.sh`.
  ALWAYS use when user provides a GitHub repository link or asks to add/package
  a program from GitHub release into Home-Manager / Nix.
  Triggers (VN): "thêm package", "đóng gói appimage", "thêm appimage", "thêm app từ github", "tải appimage từ github", "thêm deb vào nix".
  Triggers (EN): "add github package", "package appimage", "add appimage to home-manager", "add deb to nixpkgs", "package github release".
---

# Add Nix GitHub Package

Skill này hướng dẫn quy trình tiêu chuẩn để tích hợp một chương trình từ GitHub Releases (dưới dạng AppImage, .deb, .tar.gz / binary prebuilt) vào hệ thống Home-Manager Nix Flake này và tích hợp vào script tự động cập nhật `scripts/update-nix-packages.sh`.

---

## Tổng quan quy trình

Khi người dùng cung cấp link GitHub Release hoặc yêu cầu thêm package:

1. **Kiểm tra thông tin release trên GitHub**: Lấy tag name, danh sách assets, tên repo, description, license.
2. **Tải asset & tính toán SRI Hash**: Dùng `curl` tải về `/tmp` và dùng `nix hash file ... --sri` để lấy checksum chính xác.
3. **Phân tích cấu trúc package**:
   - Nếu là **AppImage**: dùng `pkgs.appimageTools.extract` để kiểm tra tên file `.desktop` và icon (`.svg`, `.png`).
   - Nếu là **Debian package (.deb)**: giải nén `ar x` & `tar xf data.tar.*` để xem đường dẫn file nhị phân và desktop file/icon.
   - Nếu là **Tarball / Binary**: xác định đường dẫn binary bên trong archive.
4. **Tạo module Derivation**: Tạo `modules/packages/<pkg-name>.nix`.
5. **Khai báo vào Flake & Packages**:
   - Thêm vào overlay trong `flake.nix`.
   - Thêm vào danh sách `home.packages` trong `modules/packages.nix`.
6. **Cấu hình tự động cập nhật trong script**:
   - Thêm entry vào mảng `PACKAGES` trong `scripts/update-nix-packages.sh`.
   - Đảm bảo regex tách version trong script hỗ trợ đúng tiền tố tag của repo (ví dụ: `v`, `release-`, `cli/v`,...).
7. **Kiểm thử**:
   - Chạy `bash ./scripts/update-nix-packages.sh <pkg-name>` để xác nhận script hoạt động.
   - Kiểm tra `git status`.

---

## Chi tiết các bước thực hiện

### Bước 1: Thu thập thông tin từ GitHub

Sử dụng lệnh sau để kiểm tra version và danh sách asset mới nhất:

```bash
curl -sL https://api.github.com/repos/<owner>/<repo>/releases/latest | jq '{tag_name: .tag_name, assets: [.assets[].name]}'
```

Xác định:

- `owner/repo`
- Format tag name (vd: `v1.2.3`, `release-1.2.3`, `1.2.3`)
- Tên chính xác của file asset cho kiến trúc x86_64 Linux (`.AppImage`, `.deb`, `.tar.gz`,...)
- Phiên bản clean (bỏ tiền tố `v`, `release-`,...)

---

### Bước 2: Tải và tính toán SRI Hash

Tải file asset về thư mục tạm và chạy lệnh tính hash:

```bash
tmp=$(mktemp)
curl -sL -o "$tmp" "<URL_ASSET>"
nix hash file "$tmp" --sri
rm -f "$tmp"
```

---

### Bước 3: Phân tích nội dung (Inspect Assets)

#### Trường hợp 1: AppImage

Kiểm tra file `.desktop` và file icon bên trong AppImage:

```bash
nix build --impure --expr 'with import <nixpkgs> {}; appimageTools.extract { pname = "<pkg-name>"; version = "<version>"; src = fetchurl { url = "<URL_ASSET>"; hash = "<SRI_HASH>"; }; }' -o /tmp/<pkg-name>-extracted
ls -la /tmp/<pkg-name>-extracted
rm -f /tmp/<pkg-name>-extracted
```

#### Trường hợp 2: Debian Package (.deb)

Kiểm tra cấu trúc debian archive:

```bash
tmp_deb=$(mktemp)
curl -sL -o "$tmp_deb" "<URL_ASSET>"
tmp_dir=$(mktemp -d)
cd "$tmp_dir" && ar x "$tmp_deb" && tar tf data.tar.*
rm -rf "$tmp_deb" "$tmp_dir"
```

---

### Bước 4: Tạo file Derivation (`modules/packages/<pkg-name>.nix`)

#### Template 1: AppImage (dùng `appimageTools.wrapType2`)

```nix
{ pkgs, ... }:

let
  pname = "<pkg-name>";
  version = "<version>";

  src = pkgs.fetchurl {
    url = "https://github.com/<owner>/<repo>/releases/download/<tag_prefix>\${version}/<filename_pattern>";
    hash = "<SRI_HASH>";
  };

  appimageContents = pkgs.appimageTools.extract { inherit pname version src; };
in

pkgs.appimageTools.wrapType2 {
  inherit pname version src;

  extraInstallCommands = ''
    install -m 444 -D \${appimageContents}/<app-id>.desktop $out/share/applications/<app-id>.desktop
    install -m 444 -D \${appimageContents}/<icon-name>.svg $out/share/icons/hicolor/scalable/apps/<icon-name>.svg
  '';

  meta = with pkgs.lib; {
    description = "<Description>";
    homepage = "https://github.com/<owner>/<repo>";
    license = licenses.<license>;
    platforms = [ "x86_64-linux" ];
    mainProgram = "<main-executable-name>";
  };
}
```

#### Template 2: Debian Package (.deb)

```nix
{ pkgs, ... }:

let
  pname = "<pkg-name>";
  version = "<version>";
in

pkgs.stdenv.mkDerivation {
  inherit pname version;

  src = pkgs.fetchurl {
    url = "https://github.com/<owner>/<repo>/releases/download/v\${version}/<filename_pattern>.deb";
    hash = "<SRI_HASH>";
  };

  dontUnpack = true;

  installPhase = ''
    ar x $src
    tar xf data.tar.*

    mkdir -p $out/bin $out/share
    cp usr/bin/<binary_name> $out/bin/
    [ -d usr/share/applications ] && cp -r usr/share/applications $out/share/
    [ -d usr/share/icons ] && cp -r usr/share/icons $out/share/
  '';

  meta = with pkgs.lib; {
    description = "<Description>";
    homepage = "https://github.com/<owner>/<repo>";
    license = licenses.<license>;
    platforms = [ "x86_64-linux" ];
    mainProgram = "<binary_name>";
  };
}
```

#### Template 3: Tarball / Binary CLI

```nix
{ pkgs, ... }:

let
  pname = "<pkg-name>";
  version = "<version>";
in

pkgs.stdenv.mkDerivation {
  inherit pname version;

  src = pkgs.fetchurl {
    url = "https://github.com/<owner>/<repo>/releases/download/v\${version}/<filename_pattern>.tar.gz";
    hash = "<SRI_HASH>";
  };

  sourceRoot = ".";

  installPhase = ''
    mkdir -p $out/bin
    cp <binary_name> $out/bin/
    chmod +x $out/bin/<binary_name>
  '';

  meta = with pkgs.lib; {
    description = "<Description>";
    homepage = "https://github.com/<owner>/<repo>";
    license = licenses.<license>;
    platforms = [ "x86_64-linux" ];
    mainProgram = "<binary_name>";
  };
}
```

---

### Bước 5: Đăng ký vào Flake & Packages

1. **`flake.nix`**: Thêm derivation vào danh sách overlay:
   ```nix
   <pkg-name> = final.callPackage ./modules/packages/<pkg-name>.nix { };
   ```
2. **`modules/packages.nix`**: Thêm tên `<pkg-name>` vào danh sách `home.packages = with pkgs; [ ... ]`.

---

### Bước 6: Thêm vào script tự động cập nhật (`scripts/update-nix-packages.sh`)

1. Thêm một dòng định dạng `"Name|NixFile|GitHubRepo|URLPattern"` vào mảng `PACKAGES` trong `scripts/update-nix-packages.sh`:
   ```bash
   "<pkg-name>|$HOME/.config/home-manager/modules/packages/<pkg-name>.nix|<owner>/<repo>|https://github.com/{repo}/releases/download/<tag_prefix>{version}/<filename_pattern>"
   ```
2. Kiểm tra phần tách version bằng regex trong hàm `update_pkg()`:
   ```bash
   latest=$(curl -sL "https://api.github.com/repos/${repo}/releases/latest" | jq -r '.tag_name // empty' | sed -E 's/^(cli\/v|release-|v)//')
   ```
   Nếu repo dùng tiền tố tag khác biệt, hãy đảm bảo `sed -E` xử lý chuẩn để lấy đúng số version sạch.

---

### Bước 7: Kiểm thử & Xác nhận

1. Chạy test script cập nhật:
   ```bash
   bash ./scripts/update-nix-packages.sh <pkg-name>
   ```
2. Kiểm tra `git status` và thông báo tóm tắt các thay đổi cho người dùng.
