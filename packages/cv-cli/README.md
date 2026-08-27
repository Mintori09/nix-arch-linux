# cv-cli

A modular CLI file format converter that orchestrates system binaries (`ffmpeg`, `pandoc`, `libreoffice`, `chromium`, etc.) via native process spawning — no heavy npm wrappers.

## Install

```bash
pnpm install
```

System deps depend on your formats (see [Supported Conversions](#supported-conversions)). Install what you need:

```bash
# Debian/Ubuntu
sudo apt-get install ffmpeg imagemagick pandoc libreoffice chromium-browser yq poppler-utils python3-pip
pip install weasyprint markitdown
npm install -g @mermaid-js/mermaid-cli
```

## Usage

```bash
pnpm start [options] <input_file> <output_file> [-- <passthrough_args>]
```

| Flag                                         | Description                     |
| -------------------------------------------- | ------------------------------- |
| `--dry-run`                                  | Preview command without running |
| `--list`                                     | List all supported format pairs |
| `--style=<file\|alias>`                      | CSS stylesheet for PDF/HTML     |
| `--reference-doc=<file>`                     | DOCX style template             |
| `--toc` / `--no-toc`                         | Table of Contents               |
| `--number-sections` / `--no-number-sections` | Numbered headings               |
| `--page-size=<size>`                         | PDF page size (a4, letter, ...) |

```bash
pnpm start init                           # scaffold ~/.config/convert-file/
pnpm start --style=modern.css --toc in.md out.pdf
pnpm start --dry-run page.mhtml out.webp
pnpm start data.json data.yaml
pnpm start video.mp4 video.webm -- -b:v 2M
```

## Configuration

`pnpm start init` creates `~/.config/convert-file/config.json`:

```json
{
  "styles": {
    "modern": "/path/to/modern.css",
    "elegant": "~/styles/elegant.css"
  },
  "referenceDocs": {
    "report": "~/templates/report.docx"
  },
  "defaults": {
    "md:pdf": {
      "css": "~/styles/pdf-theme.css",
      "pageSize": "letter",
      "toc": true,
      "numberSections": true
    },
    "md:docx": {
      "referenceDoc": "~/templates/report.docx",
      "toc": false
    }
  }
}
```

## Supported Conversions

| Source                        | Target                | Binary              |
| ----------------------------- | --------------------- | ------------------- |
| mp4, mkv, mov, avi, webm, flv | mp4, mkv, webm        | ffmpeg              |
| mp4, wav, flac, m4a, ogg, mp3 | mp3, wav, ogg         | ffmpeg              |
| gif                           | mp4                   | ffmpeg              |
| png, jpg, webp, svg, ...      | png, jpg, webp        | magick              |
| mhtml                         | png, jpg, webp        | chromium + magick   |
| md                            | pdf                   | pandoc + weasyprint |
| md                            | docx, html, epub      | pandoc              |
| doc, docx                     | md, html, epub, txt   | pandoc              |
| html, txt, rst                | md                    | markitdown / pandoc |
| epub                          | md, pdf               | pandoc + weasyprint |
| docx, xlsx, pptx, odt, ...    | pdf                   | soffice             |
| xlsx                          | csv                   | xlsx2csv            |
| pdf                           | png, jpg, webp        | pdftoppm            |
| json, yaml, toml, csv, xml    | json, yaml, toml, csv | yq                  |

## Development

```bash
pnpm start       # run
pnpm test        # test
pnpm typecheck   # typecheck
pnpm fmt         # format
pnpm build       # build
```

To add a converter: define it in `src/converters/index.ts`, register the route in `src/routes.ts`.

## Shell Completions

```bash
mkdir -p ~/.zsh/completions && cp completions/_cv ~/.zsh/completions/
echo 'fpath=(~/.zsh/completions $fpath); autoload -Uz compinit && compinit' >> ~/.zshrc
exec zsh
```

## License

MIT
