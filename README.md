# nix-arch-linux

A declarative configuration for Arch Linux using Nix Flakes and Home Manager.

## Features

- **Declarative Package Management**: Uses `home.packages` and Nix flakes for reproducible software environments.
- **Shell Configuration**: Zsh configuration with Powerlevel10k theme (`p10k.zsh`).
- **Custom Scripts**: A collection of utility scripts for file conversion, formatting, and system tasks.

## Refactor Safety

Before structural cleanup, use the docs in `docs/refactor/`:

- `module-map.md` for module ownership
- `parity-checklist.md` for behavior-preserving validation
- `dead-code-candidates.md` for evidence-backed deletions

## Tools

Located in `tools/mdview/`:

- **mdview**: Go-based CLI markdown viewer/editor with an embedded web frontend. Supports live preview, editing with write token protection, multiple themes (warm, minimal, dark, paper), and Mermaid diagram rendering.

## Scripts

Located in `scripts/execute/`:

- **convert-file.ts**: Converts files between formats using tools like FFmpeg, ImageMagick, Pandoc, LibreOffice, and Yq.
- **format-file.ts**: Formats source code and files using Prettier and external formatters.
- **install-font.ts**: Downloads and installs fonts, refreshing the font cache.
- **install-rpm.ts**: Extracts and installs RPM packages on non-RPM distros (like Arch).
- **which_file.ts**: Locates commands, checking for executables, symlinks, and zsh functions.
- **fzf-preview.sh**: Preview script for `fzf` supporting images, PDFs, videos, and more.
- **fzf-rg-edit.sh**: Integrates `ripgrep` with `fzf` for searching and editing files.

## Programs

Located in `modules/programs/`:

- **yt-dlp**: Configured for downloading video/audio with specific format, metadata, and subtitle settings. Includes a `download-music` alias.

## Usage

### Applying Configuration

To apply the Home Manager configuration:

```bash
hms
```

### Downloading Media

Download video (uses config defaults):

```bash
yt-dlp <url>
```

Download music (MP3 format):

```bash
download-music <url>
```

## Prerequisites

- Nix with Flakes enabled.
- Home Manager installed in standalone mode.
