# MultiLinkExtractor

A tool for quickly extracting direct download links from FuckingFast and DataNodes services with automatic downloading capabilities.

## Features

- ⚡ **Fast direct link extraction** for FuckingFast and DataNodes services.
- 📥 **Direct download by default**: Automatically downloads files right after extracting links.
- 🎯 **Flexible input methods**: CLI arguments, file input (`-f`), pipe/stdin, interactive prompt, or default `links.txt`.
- 📁 **Selective output**: Output files are generated only when explicitly requested (`-o` / `--output`).
- 📂 **Custom download directory**: Easily specify destination folder with `-d` / `--dest`.
- ⚡ **Zsh / Bash Autocompletion support**.

---

## Setup

1. Clone or download this repository.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. (If not already installed) Install Playwright browser dependencies:
   ```bash
   playwright install chromium
   ```

---

## Usage & Examples

### 1. Pass URLs directly as CLI arguments (Downloads immediately)

```bash
python main.py https://fuckingfast.co/xxx https://datanodes.to/yyy
```

### 2. Interactive prompt (Paste URLs directly in terminal)

```bash
python main.py
```

> Paste your URLs and press `Enter` on an empty line or `Ctrl+D` to start extraction and downloading.

### 3. Read URLs from a file

```bash
python main.py -f my_links.txt -d ./downloads
```

### 4. Read from Pipe / Stdin

```bash
cat links.txt | python main.py
```

### 5. Extract links only (Do not download) and save to output file

```bash
python main.py -f links.txt --extract-only -o direct_links.txt
```

---

## CLI Options (`-h` / `--help`)

```text
usage: main.py [-h] [-f FILE] [-o OUTPUT] [-d DEST] [-e] [--completion [{zsh,bash}]] [urls ...]

MultiLinkExtractor: Fast direct download link extraction & automated downloader for FuckingFast and DataNodes.

positional arguments:
  urls                  One or more URLs to extract and download.

options:
  -h, --help            show this help message and exit
  -f, --file FILE       Path to file containing URLs (one per line).
  -o, --output OUTPUT   Path to output file for extracted direct links (only saved if specified).
  -d, --dest DEST       Destination directory for downloaded files (default: .).
  -e, --extract-only, --no-download
                        Extract direct links only without downloading files.
  --completion [{zsh,bash}]
                        Generate shell completion script (default: zsh).
```

---

## Zsh Autocomplete Setup

### Option 1: Quick load in current session / ~/.zshrc

Add the following line to your `~/.zshrc`:

```zsh
eval "$(python /path/to/MultiLinkExtractor/main.py --completion zsh)"
```

### Option 2: Using the included `_mle` completion file

Copy `_mle` to any folder in your `$fpath` (e.g. `~/.zfunc`):

```zsh
mkdir -p ~/.zfunc
cp _mle ~/.zfunc/
```

Ensure `~/.zshrc` has:

```zsh
fpath=(~/.zfunc $fpath)
autoload -Uz compinit && compinit
```

---

## Disclaimer

This tool is for educational purposes only. Please respect the terms of service of the websites you interact with.
