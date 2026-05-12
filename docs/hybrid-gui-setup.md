# Hybrid Nix + System GUI Setup

## Problem
Trên Linux non-NixOS, GUI apps thường gặp lỗi do xung đột thư viện giữa Nix và hệ thống.

## Solution: Hybrid Mode

### Cách dùng:
```bash
# Khởi tạo project GUI với hybrid mode
dw init qt --gui        # Qt app
dw init gtk --gui       # GTK app  
dw init wails --gui     # Wails app
dw init tauri --gui     # Tauri app

# Kích hoạt
cd myproject
direnv allow
chmod +x run-gui.sh

# Chạy app
./run-gui.sh ./my-qt-app
```

### Cơ chế:
1. **`.envrc`**: `export LD_LIBRARY_PATH=""` → dùng thư viện hệ thống
2. **`shell.nix`**: Chỉ cài tools (compiler, cmake), không GUI libraries
3. **`run-gui.sh`**: Wrapper thiết lập env cho GUI apps

### Ví dụ .envrc được tạo:
```bash
use nix
# Nix provides tools (compiler, cmake), system provides GUI libs
export LD_LIBRARY_PATH=""
export QT_QPA_PLATFORM=xcb
```

### Ví dụ shell.nix được tạo:
```nix
{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  buildInputs = with pkgs; [
    qt5.qtbase cmake  # Chỉ tools, không GUI libs
  ];
  shellHook = ''
    export LD_LIBRARY_PATH=""  # Dùng system libraries
  '';
}
```