# Configuration Guide

## Quick Start

```bash
cv init
```

This creates:

- `~/.config/convert-file/config.json` — route defaults, style aliases, and reference doc aliases
- `~/.config/convert-file/styles/pdf.css` — default PDF print style
- `~/.config/convert-file/styles/html.css` — default HTML screen style
- `~/.config/convert-file/styles/docx2html.css` — default docx-to-HTML style
- `~/.config/convert-file/numbered-sections.docx` — default numbered-sections docx template for `md:docx`

After init, conversions use built-in defaults automatically:

```bash
cv doc.md output.pdf      # uses pdf.css, pageSize=a4, toc
cv doc.md output.html     # uses html.css, toc, number-sections
cv doc.md output.docx     # uses numbered-sections.docx, toc
cv document.docx out.html # uses docx2html.css
```

## Config File

### Structure

`~/.config/convert-file/config.json`:

```json
{
  "styles": {
    "blog": "~/projects/blog/theme.css"
  },
  "referenceDocs": {
    "modern": "~/templates/modern.docx"
  },
  "defaults": {
    "md:pdf": {
      "css": "~/.config/convert-file/styles/pdf.css",
      "pageSize": "a4",
      "toc": true,
      "numberSections": false,
      "metadataFile": "~/metadata.json",
      "wrap": "none"
    },
    "md:docx": {
      "referenceDoc": "~/.config/convert-file/numbered-sections.docx",
      "toc": true,
      "numberSections": false,
      "metadataFile": "~/metadata.json",
      "wrap": "none",
      "extractMedia": "./media"
    },
    "md:html": {
      "css": "~/.config/convert-file/styles/html.css",
      "toc": true,
      "numberSections": true,
      "metadataFile": "~/metadata.json",
      "wrap": "none",
      "extractMedia": "./media"
    },
    "md:epub": {
      "toc": true,
      "numberSections": false,
      "metadataFile": "~/metadata.json"
    },
    "docx:html": {
      "css": "~/.config/convert-file/styles/docx2html.css",
      "extractMedia": "./media"
    }
  }
}
```

### `styles` — Style Aliases

Short names for CSS file paths. Use with `--style`:

```bash
cv doc.md output.html --style blog
```

The value is resolved from the `styles` map in config.

### `referenceDocs` — Reference Doc Aliases

Short names for .docx template file paths. Use with `--reference-doc`:

```bash
cv doc.md output.docx --reference-doc modern
```

The value is resolved from the `referenceDocs` map in config.

### `defaults` — Per-Route Defaults

Default flags applied per conversion route. CLI flags always override these.

#### Supported Fields

| Field            | CLI flag                                     | Type                                         | Applied to routes                         |
| ---------------- | -------------------------------------------- | -------------------------------------------- | ----------------------------------------- |
| `css`            | `--style`                                    | string (file path)                           | All pandoc routes that support `--css`    |
| `pageSize`       | `--page-size`                                | string (`a3`, `a4`, `a5`, `letter`, `legal`) | `md:pdf`                                  |
| `toc`            | `--toc` / `--no-toc`                         | boolean                                      | `md:pdf`, `md:html`, `md:docx`, `md:epub` |
| `numberSections` | `--number-sections` / `--no-number-sections` | boolean                                      | `md:pdf`, `md:html`, `md:docx`, `md:epub` |
| `referenceDoc`   | `--reference-doc`                            | string (file path or alias)                  | `md:docx`                                 |
| `metadataFile`   | `--metadata-file`                            | string (file path)                           | All pandoc routes                         |
| `wrap`           | `--wrap`                                     | `"none"` or `"preserve"`                     | `md:pdf`, `md:html`, `md:docx`            |
| `extractMedia`   | `--extract-media`                            | string (dir path)                            | `md:html`, `md:docx`                      |

### Path Resolution

Config file paths support:

- **Absolute**: `/home/user/styles/custom.css`
- **Tilde**: `~/styles/custom.css` — expands to `$HOME/styles/custom.css`
- **Relative**: Resolved from the current working directory

## Priority Order

```
built-in (code)  <  config.json  <  CLI flags
```

1. **Built-in** — code-level fallbacks (only `md:pdf` → `pageSize: "a4"`)
2. **config.json** — your defaults override built-in values
3. **CLI flags** — override everything when explicitly passed

### Examples

```bash
# Uses defaults: pdf.css, pageSize=a4, toc
cv doc.md output.pdf

# Override page-size only, keep other defaults
cv doc.md output.pdf --page-size letter

# Override CSS, disable toc
cv doc.md output.html --style ~/custom.css --no-toc

# No defaults applied (route not in defaults map)
cv photo.png output.jpg
```

## CSS Templates

### pdf.css

Print-optimized style for WeasyPrint output:

- Serif body (Georgia / Times New Roman), 12pt
- A4 page with 2cm margins
- Page breaks before `<h1>`
- Code blocks with gray background, border, monospace font
- Tables with borders, page-break-inside: avoid
- Inline code with background highlight

### html.css

Screen-optimized style for HTML output:

- System sans-serif font stack
- Centered max-width container (800px)
- Syntax highlight backgrounds
- Responsive tables (horizontal scroll)
- Blockquote with left border
- Inline code with background

### docx2html.css

Document-replay style for docx-to-HTML output:

- Calibri-based font stack (11pt)
- Table with borders and alternating row background
- Clean heading hierarchy spacing
- Inline code with background
- Blockquote with left border

### Customizing

Edit the CSS files directly:

```bash
$EDITOR ~/.config/convert-file/styles/pdf.css
```

Create custom files and use `--style` for a single run:

```bash
cv doc.md output.pdf --style ~/my-print.css
```

Point to a different CSS in config.json for all runs:

```json
{
  "defaults": {
    "md:pdf": { "css": "~/my-print.css" }
  }
}
```

## Supported Routes

### Document routes

| Route       | Tool                | Supported defaults                                                  |
| ----------- | ------------------- | ------------------------------------------------------------------- |
| `md:pdf`    | pandoc + weasyprint | css, pageSize, toc, numberSections, metadataFile, wrap              |
| `md:docx`   | pandoc              | referenceDoc, toc, numberSections, metadataFile, wrap, extractMedia |
| `md:html`   | pandoc              | css, toc, numberSections, metadataFile, wrap, extractMedia          |
| `md:epub`   | pandoc              | toc, numberSections, metadataFile                                   |
| `docx:html` | pandoc              | css, extractMedia                                                   |
| `doc:md`    | pandoc              | —                                                                   |
| `docx:md`   | pandoc              | extractMedia                                                        |
| `docx:txt`  | pandoc              | —                                                                   |
| `html:md`   | pandoc              | —                                                                   |
| `rst:md`    | pandoc              | —                                                                   |
| `docx:pdf`  | LibreOffice         | —                                                                   |
| `xlsx:pdf`  | LibreOffice         | —                                                                   |
| `pptx:pdf`  | LibreOffice         | —                                                                   |

### Media routes

| Route                                  | Tool        | Notes                              |
| -------------------------------------- | ----------- | ---------------------------------- |
| `mp4:mkv`, `mkv:mp4`, `mov:mp4`, etc.  | ffmpeg      | Passthrough args for codec options |
| `png:jpg`, `svg:png`, `webp:png`, etc. | ImageMagick | Passthrough args for image options |
| `pdf:png`, `pdf:jpg`, `pdf:webp`       | pdftoppm    | —                                  |
| `json:yaml`, `yaml:json`, etc.         | yq          | —                                  |
| `mhtml:png`, `mhtml:jpg`, `mhtml:webp` | chromium    | —                                  |

Passthrough args are any arguments after input/output files. They are forwarded directly to the underlying tool.

## Comparison: Old vs New Behavior

### Before (old)

```bash
# Had to specify everything every time
cv doc.md output.pdf --page-size a4 --toc --style ~/pdf.css

# No CSS for HTML
cv doc.md output.html

# No CSS for docx-to-HTML
cv document.docx out.html
```

### After (new)

```bash
# Uses defaults from config.json
cv doc.md output.pdf

# Override only what's needed
cv doc.md output.pdf --page-size letter

# CSS templates available via cv init
cv init
cv doc.md output.html    # uses html.css automatically
cv doc.docx out.html      # uses docx2html.css automatically
```
