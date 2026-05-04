# GUI Desktop Entries Design

**Date:** 2026-04-30

## Goal

Hiển thị các ứng dụng GUI được bọc qua `nixGL` trong app launcher bằng cách bổ sung `.desktop` entries với metadata đầy đủ trong cấu hình Home Manager.

## Current State

- `modules/programs/_nixgl-wrappers.nix` chỉ tạo wrapper trong `bin/` bằng `pkgs.writeShellScriptBin`.
- Các app trong `modules/programs/packages.nix` vì vậy có binary chạy được nhưng không mang theo file `.desktop`.
- Repo hiện đã có pattern launcher tùy biến bằng `xdg.desktopEntries` ở `modules/programs/alacritty.nix` và `modules/programs/kitty.nix`.

## Scope

Áp dụng cho toàn bộ app GUI hiện đang được bọc trong `modules/programs/packages.nix`:

- `mpv`
- `obsidian`
- `hoppscotch`
- `nautilus`
- `vicinae`
- `gimp`

## Approach Options

### Option 1: Add `xdg.desktopEntries` in `packages.nix`

Khai báo launcher thủ công cho từng app, trỏ `Exec` vào wrapper đã bọc `nixGL`.

Pros:
- Khớp pattern sẵn có của repo
- Rủi ro thấp
- Dễ kiểm soát metadata từng app

Cons:
- Có lặp cấu hình

### Option 2: Patch wrapper để copy launcher từ package gốc

Mở rộng `mkWrappedBinary` để sao chép `share/applications` rồi sửa `Exec`.

Pros:
- Tái sử dụng metadata gốc

Cons:
- Phức tạp hơn
- Không đồng nhất giữa các package
- Không theo pattern repo hiện tại

### Option 3: Tạo helper mới trả về cả wrapper lẫn launcher

Tạo abstraction mới để giảm lặp.

Pros:
- Dễ mở rộng về sau

Cons:
- Refactor quá mức cho nhu cầu hiện tại

## Chosen Design

Chọn Option 1.

Trong `modules/programs/packages.nix`:

- Tách từng wrapper thành biến `let` để có thể dùng lại ở cả `home.packages` và `xdg.desktopEntries`.
- Thêm `xdg.desktopEntries` cho 6 ứng dụng GUI.
- Mỗi entry sẽ có:
  - `name`
  - `genericName`
  - `comment`
  - `exec`
  - `icon`
  - `categories`
  - `terminal = false`
  - `startupNotify = true`
- `exec` luôn trỏ vào `${wrappedPackage}/bin/<name>` để launcher gọi đúng binary đã bọc `nixGL`.

## Metadata Expectations

- `mpv`: media player categories, icon `mpv`
- `obsidian`: note taking / office categories, icon `obsidian`
- `hoppscotch`: development / network categories, icon `hoppscotch`
- `nautilus`: file manager categories, icon `org.gnome.Nautilus`
- `vicinae`: utility categories, icon ưu tiên `vicinae` nếu package có cung cấp icon cùng tên
- `gimp`: graphics / raster editor categories, icon `gimp`

Nếu một icon name không được theme resolve, launcher vẫn hoạt động; chỉ ảnh hưởng icon hiển thị.

## Error Handling

- Không thay đổi logic wrapper hiện tại.
- Không override launcher gốc trong package vì hiện launcher gốc không đi kèm wrapper này.
- Nếu có app về sau cần `mimeType`, bổ sung riêng sau; thay đổi hiện tại tập trung vào hiển thị launcher và chạy đúng `Exec`.

## Testing

- Chạy đánh giá Home Manager hoặc `nix` check phù hợp để xác nhận cú pháp Nix hợp lệ.
- Sau khi apply cấu hình, kiểm tra các file `.desktop` được sinh dưới profile Home Manager.
- Xác nhận launcher của từng app xuất hiện trong app menu và `Exec` trỏ về wrapper trong store.
