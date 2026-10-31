---
name: nix-add-github-package
description: >
  Automatically packages applications or CLI tools from GitHub Releases (AppImage,
  Debian .deb, tarball/tar.xz/tar.gz, prebuilt binary) into this Nix Home-Manager
  configuration, registers them into `flake.nix` overlay and `modules/packages.nix`,
  and configures auto-updating via nvfetcher (preferred) or manual fallback.
  ALWAYS use when user provides a GitHub repository link or asks to add/package
  a program from GitHub release into Home-Manager / Nix.
  Triggers (VN): "thêm package", "đóng gói appimage", "thêm appimage", "thêm app từ github", "tải appimage từ github", "thêm deb vào nix".
  Triggers (EN): "add github package", "package appimage", "add appimage to home-manager", "add deb to nixpkgs", "package github release".
---

# Add Nix GitHub Package

Skill này hướng dẫn quy trình tiêu chuẩn để tích hợp một chương trình từ GitHub Releases (AppImage, .deb, .tar.gz / binary prebuilt) vào hệ thống Home-Manager Nix Flake này.

> [!IMPORTANT]
> **CHIẾN LƯỢC QUẢN LÝ NGUỒN (SOURCE MANAGEMENT STRATEGY):**
> 1. **Ưu tiên 1 (Mặc định)**: Sử dụng **`nvfetcher`** (`nvfetcher.toml` + `modules/packages/_sources/generated.nix`). Tự động theo dõi release, tính SHA256 SRI hash, và quản lý metadata tập trung.
> 2. **Fallback**: Chỉ dùng hardcoded `fetchurl` với hash thủ công trực tiếp trong file `.nix` khi package có cơ chế release quá đặc thù mà `nvfetcher` không hỗ trợ hoặc theo yêu cầu đặc biệt.

---

## Tổng quan quy trình chuẩn (với nvfetcher)

1. **Khảo sát GitHub Release**:
   - Kiểm tra tag name format (`vX.Y.Z`, `release-X.Y.Z`, `X.Y.Z`,...) và tên asset trên release page.
2. **Khai báo vào `nvfetcher.toml`**:
   - Thêm block cấu hình theo dõi release upstream và URL asset download.
3. **Sinh nguồn tự động với `nvfetcher`**:
   - Chạy lệnh cập nhật để sinh metadata vào `modules/packages/_sources/generated.nix`.
4. **Phân tích cấu trúc file nhị phân / asset**:
   - Trích xuất file `.desktop`, icon hoặc binary path.
5. **Tạo module Derivation (`modules/packages/<pkg-name>.nix`)**:
   - Đọc trực tiếp từ `sources.<pkg-name>`.
6. **Đăng ký vào Flake & Packages**:
   - Thêm vào overlay trong `flake.nix` (hoặc `modules/packages.nix` nếu cần).
   - Thêm vào `home.packages`.
7. **Kiểm thử & Switch**:
   - Build và apply bằng `nh home switch ~/.config/home-manager`.

---

## Chi tiết các bước thực hiện

### Bước 1: Khảo sát Release từ GitHub

Kiểm tra release mới nhất và danh sách các asset:

```bash
curl -sL https://api.github.com/repos/<owner>/<repo>/releases/latest | jq '{tag_name: .tag_name, assets: [.assets[].name]}'
```

Xác định:
- `<owner>/<repo>`
- Tiền tố tag: `v`, `release-`, `cli/v`,...
- Định dạng tên file asset x86_64 Linux: ví dụ `<name>_$ver_linux_amd64.tar.gz`, `<name>-$ver.AppImage`, `<name>_$ver_amd64.deb`.

---

### Bước 2 (Ưu tiên): Khai báo vào `nvfetcher.toml` & Sinh nguồn

Mở file `nvfetcher.toml` tại root repo và thêm cấu hình:

```toml
[<pkg-name>]
src.github = "<owner>/<repo>"
src.prefix = "<tag_prefix>"  # Ví dụ: "v", hoặc "release-", hoặc "cli/v"
fetch.url = "https://github.com/<owner>/<repo>/releases/download/<tag_prefix>$ver/<filename_pattern_with_$ver>"
```

*Lưu ý:*
- Biến `$ver` là số phiên bản đã được cắt bỏ `src.prefix`.
- Ví dụ với tag `v1.2.3`: đặt `src.prefix = "v"`, thì `$ver` sẽ là `1.2.3`. URL download sẽ dùng `<tag_prefix>$ver` (tức `v$ver`).

Chạy `nvfetcher` để tự động fetch và sinh hash:

```bash
nvfetcher -c nvfetcher.toml -o modules/packages/_sources -f <pkg-name>
```

Sau khi chạy xong, kiểm tra `modules/packages/_sources/generated.nix` sẽ có entry:
```nix
<pkg-name> = {
  pname = "<pkg-name>";
  version = "...";
  src = fetchurl { ... sha256 = "..."; };
};
```

---

### Bước 3: Phân tích cấu trúc Asset (Inspect)

#### 1. Đối với AppImage
Dùng `appimageTools.extract` để kiểm tra tên file `.desktop` và icon:

```bash
nix build --impure --expr 'with import <nixpkgs> {}; let sources = callPackage ./modules/packages/_sources/generated.nix {}; in appimageTools.extract { inherit (sources.<pkg-name>) pname version src; }' -o /tmp/<pkg-name>-extracted
ls -la /tmp/<pkg-name>-extracted
rm -f /tmp/<pkg-name>-extracted
```

#### 2. Đối với Debian Package (.deb)
Kiểm tra đường dẫn nhị phân và desktop file:

```bash
nix build --impure --expr 'with import <nixpkgs> {}; let sources = callPackage ./modules/packages/_sources/generated.nix {}; in runCommand "inspect" {} "ar x ${sources.<pkg-name>.src} && tar tf data.tar.* > $out"' -o /tmp/deb-content
cat /tmp/deb-content
rm -f /tmp/deb-content
```

---

### Bước 4: Tạo Derivation (`modules/packages/<pkg-name>.nix`)

Tất cả derivation sử dụng `sources = pkgs.callPackage ./_sources/generated.nix { };`.

#### Template 1: AppImage (dùng `appimageTools.wrapType2`)

```nix
{ pkgs, ... }:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
  inherit (sources.<pkg-name>) pname version src;

  appimageContents = pkgs.appimageTools.extract { inherit pname version src; };
in

pkgs.appimageTools.wrapType2 {
  inherit pname version src;

  extraInstallCommands = ''
    install -m 444 -D ${appimageContents}/<app-id>.desktop $out/share/applications/<app-id>.desktop
    substituteInPlace $out/share/applications/<app-id>.desktop \
      --replace-fail 'Exec=<old_exec>' "Exec=$out/bin/${pname}"
    install -m 444 -D ${appimageContents}/<icon-name>.svg $out/share/icons/hicolor/scalable/apps/<icon-name>.svg
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
  sources = pkgs.callPackage ./_sources/generated.nix { };
in

pkgs.stdenv.mkDerivation {
  inherit (sources.<pkg-name>) pname version src;

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
  sources = pkgs.callPackage ./_sources/generated.nix { };
in

pkgs.stdenv.mkDerivation {
  inherit (sources.<pkg-name>) pname version src;

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

1. **`flake.nix`**: Thêm derivation vào overlay (nếu package độc lập):
   ```nix
   <pkg-name> = final.callPackage ./modules/packages/<pkg-name>.nix { };
   ```
2. **`modules/packages.nix`**: Thêm tên `<pkg-name>` vào danh sách `home.packages = with pkgs; [ ... ]`.

---

### Bước 6: Kiểm thử & Áp dụng

1. **Theo dõi file mới trong git**:
   ```bash
   git add -N nvfetcher.toml modules/packages/_sources/ modules/packages/<pkg-name>.nix
   ```
2. **Test cập nhật với script**:
   ```bash
   scripts/update-nix-packages.sh <pkg-name>
   ```
3. **Áp dụng cấu hình Home-Manager**:
   ```bash
   nh home switch ~/.config/home-manager
   ```
4. **Kiểm tra binary**:
   ```bash
   which <pkg-name>
   ```

---

## Phương án Fallback (Thủ công không qua nvfetcher)

Chỉ sử dụng khi package có URL download phức tạp, asset tên không cố định hoặc dynamic token mà nvfetcher không xử lý được:

1. **Tải asset & tính hash thủ công**:
   ```bash
   tmp=$(mktemp)
   curl -sL -o "$tmp" "<URL_ASSET>"
   nix hash file "$tmp" --sri
   rm -f "$tmp"
   ```
2. **Khai báo trực tiếp `fetchurl` trong `.nix`**:
   ```nix
   version = "<version>";
   src = pkgs.fetchurl {
     url = "<DIRECT_URL>";
     hash = "<SRI_HASH>";
   };
   ```
3. Đăng ký vào `flake.nix` và `modules/packages.nix` như bình thường.
