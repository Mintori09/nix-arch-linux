---
name: nix-add-github-package
description: >
  Automatically packages applications or CLI tools from GitHub Releases (prebuilt
  tarball/binary, Debian .deb, AppImage) into this Nix Home-Manager configuration,
  registers them into `flake.nix` overlay and `modules/packages.nix`, and configures
  auto-updating via nvfetcher (preferred) or manual fallback.
  Prioritizes standalone tarball/binary and .deb over AppImage whenever multiple formats exist.
  ALWAYS use when user provides a GitHub repository link or asks to add/package
  a program from GitHub release into Home-Manager / Nix.
  Triggers (VN): "thêm package", "đóng gói appimage", "thêm appimage", "thêm app từ github", "tải appimage từ github", "thêm deb vào nix".
  Triggers (EN): "add github package", "package appimage", "add appimage to home-manager", "add deb to nixpkgs", "package github release".
---

# Add Nix GitHub Package

Skill này hướng dẫn quy trình tiêu chuẩn để tích hợp một chương trình từ GitHub Releases vào hệ thống Home-Manager Nix Flake này.

> [!IMPORTANT]
> **1. CHIẾN LƯỢC ƯU TIÊN ĐỊNH DẠNG ASSET (PACKAGE FORMAT PRIORITY):**
> Khi upstream GitHub Release cung cấp nhiều định dạng asset cho Linux x86_64, **BẮT BUỘC** tuân thủ thứ tự ưu tiên sau:
> - **Ưu tiên 1 (Cao nhất): Prebuilt Tarball / Static Binary (`.tar.gz`, `.tar.xz`, raw binary)**:
>   - *Lý do*: Nhẹ nhất, không overhead wrapper, thời gian khởi động nhanh nhất, tích hợp trực tiếp vào Nix profile sạch sẽ. Nếu binary động cần runtime thì dùng `autoPatchelfHook`.
> - **Ưu tiên 2: Debian Package (`.deb`)**:
>   - *Lý do*: Chứa sẵn phân tầng thư mục chuẩn (`usr/bin`, `usr/share/applications`, `usr/share/icons`), giải nén bằng `ar` và `tar` cực nhanh, không cần mount FUSE filesystem.
> - **Ưu tiên 3 (Thấp nhất - Lựa chọn cuối cùng): AppImage (`.AppImage`)**:
>   - *Lý do*: Chỉ dùng khi upstream **KHÔNG** cung cấp `.tar.gz`, prebuilt binary hoặc `.deb`. AppImage yêu cầu trích xuất unpack hoặc chạy qua FUSE/wrapper Type2 gây tốn dung lượng ổ đĩa và overhead khi khởi động.
>
> **2. CHIẾN LƯỢC QUẢN LÝ NGUỒN (SOURCE MANAGEMENT STRATEGY):**
> - **Mặc định (Ưu tiên)**: Sử dụng **`nvfetcher`** (`nvfetcher.toml` + `modules/packages/_sources/generated.nix`). Tự động theo dõi release, tính SRI sha256 hash và quản lý metadata tập trung.
> - **Fallback**: Chỉ dùng hardcoded `fetchurl` với hash thủ công trực tiếp trong file `.nix` khi package có URL download quá đặc thù mà `nvfetcher` không hỗ trợ.

---

## Tổng quan quy trình chuẩn (với nvfetcher)

1. **Khảo sát GitHub Release & Chọn Asset theo thứ tự ưu tiên**:
   - Liệt kê toàn bộ assets.
   - Chọn asset theo thứ tự: `.tar.gz / .tar.xz / binary` ➔ `.deb` ➔ `.AppImage`.
2. **Khai báo vào `nvfetcher.toml`**:
   - Thêm block cấu hình theo dõi release upstream và URL asset download đã chọn.
3. **Sinh nguồn tự động với `nvfetcher`**:
   - Chạy lệnh cập nhật để sinh metadata vào `modules/packages/_sources/generated.nix`.
4. **Phân tích cấu trúc file nhị phân / asset**:
   - Trích xuất file nhị phân, `.desktop`, icon.
5. **Tạo module Derivation (`modules/packages/<pkg-name>.nix`)**:
   - Đọc trực tiếp từ `sources.<pkg-name>`.
6. **Đăng ký vào Flake & Packages**:
   - Thêm vào overlay trong `flake.nix` (hoặc `modules/packages.nix` nếu cần).
   - Thêm vào `home.packages`.
7. **Kiểm thử & Switch**:
   - Build và apply bằng `nh home switch ~/.config/home-manager`.

---

## Chi tiết các bước thực hiện

### Bước 1: Khảo sát Release từ GitHub & Chọn Asset

Kiểm tra release mới nhất và danh sách các asset:

```bash
curl -sL https://api.github.com/repos/<owner>/<repo>/releases/latest | jq '{tag_name: .tag_name, assets: [.assets[].name]}'
```

**Nguyên tắc chọn Asset**:
1. Tìm asset Linux `x86_64` / `amd64` có đuôi `.tar.gz`, `.tar.xz`, `.zip` hoặc binary không đuôi. Nếu có ➔ **CHỌN NGAY**.
2. Nếu không có tarball, tìm file đuôi `.deb` (Debian/Ubuntu package) ➔ **CHỌN**.
3. Nếu chỉ có `.AppImage` hoặc các định dạng đóng gói ảo khác ➔ **MỚI CHỌN AppImage**.

Xác định:
- `<owner>/<repo>`
- Tiền tố tag: `v`, `release-`, `cli/v`,...
- Tên mẫu asset đã chọn: ví dụ `<name>_$ver_linux_amd64.tar.gz`, `<name>_$ver_amd64.deb`, hoặc `<name>-$ver.AppImage`.

---

### Bước 2: Khai báo vào `nvfetcher.toml` & Sinh nguồn

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

#### 1. Đối với Tarball / Raw Binary (Ưu tiên 1)
Kiểm tra cấu trúc file nén và tìm file thực thi:

```bash
nix build --impure --expr 'with import <nixpkgs> {}; let sources = callPackage ./modules/packages/_sources/generated.nix {}; in runCommand "inspect-tar" {} "mkdir -p $out && tar tf ${sources.<pkg-name>.src} > $out/files.txt"' -o /tmp/tar-content
cat /tmp/tar-content/files.txt
rm -rf /tmp/tar-content
```

#### 2. Đối với Debian Package (.deb) (Ưu tiên 2)
Kiểm tra đường dẫn nhị phân và desktop file bên trong deb:

```bash
nix build --impure --expr 'with import <nixpkgs> {}; let sources = callPackage ./modules/packages/_sources/generated.nix {}; in runCommand "inspect-deb" {} "ar x ${sources.<pkg-name>.src} && tar tf data.tar.* > $out"' -o /tmp/deb-content
cat /tmp/deb-content
rm -f /tmp/deb-content
```

#### 3. Đối với AppImage (Lựa chọn cuối)
Dùng `appimageTools.extract` để kiểm tra tên file `.desktop` và icon:

```bash
nix build --impure --expr 'with import <nixpkgs> {}; let sources = callPackage ./modules/packages/_sources/generated.nix {}; in appimageTools.extract { inherit (sources.<pkg-name>) pname version src; }' -o /tmp/<pkg-name>-extracted
ls -la /tmp/<pkg-name>-extracted
rm -f /tmp/<pkg-name>-extracted
```

---

### Bước 4: Tạo Derivation (`modules/packages/<pkg-name>.nix`)

Tất cả derivation sử dụng `sources = pkgs.callPackage ./_sources/generated.nix { };`.

#### Template 1: Tarball / Binary (Ưu tiên hàng đầu)

```nix
{ pkgs, ... }:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
in

pkgs.stdenv.mkDerivation {
  inherit (sources.<pkg-name>) pname version src;

  sourceRoot = ".";

  # Bỏ comment nếu là binary ELF động cần patch thư viện
  # nativeBuildInputs = [ pkgs.autoPatchelfHook ];
  # buildInputs = [ pkgs.stdenv.cc.cc.lib ];

  installPhase = ''
    mkdir -p $out/bin
    cp <binary_name> $out/bin/
    chmod +x $out/bin/<binary_name>

    # Nếu có file desktop / icon đi kèm trong tarball
    if [ -d share ]; then
      cp -r share $out/
    fi
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

#### Template 2: Debian Package (.deb) (Ưu tiên 2)

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

#### Template 3: AppImage (Chỉ dùng khi không có dạng khác)

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
