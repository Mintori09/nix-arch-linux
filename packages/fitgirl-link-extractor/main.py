import argparse
import asyncio
import os
import re
import sys
import time
from urllib.parse import unquote, urlparse

# Shell completion scripts
ZSH_COMPLETION = """#compdef main.py mle multilinkextractor python

_mle_completion() {
    local context state state_descr line
    typeset -A opt_args

    _arguments -C \\
        '(-h --help)'{-h,--help}'[Show help message and exit]' \\
        '(-f --file)'{-f,--file}'[Read URLs from file]:input file:_files' \\
        '(-o --output)'{-o,--output}'[Save extracted direct links to file]:output file:_files' \\
        '(-d --dest)'{-d,--dest}'[Destination directory for downloaded files]:destination directory:_files -/' \\
        '(-e --extract-only --no-download)'{-e,--extract-only,--no-download}'[Extract direct links only without downloading]' \\
        '--completion[Print shell completion script]:shell:(zsh bash)' \\
        '*:URL:_urls'
}

_mle_completion "$@"
"""

BASH_COMPLETION = """_mle_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    opts="-h --help -f --file -o --output -d --dest -e --extract-only --no-download --completion"

    case "${prev}" in
        -f|--file|-o|--output)
            COMPREPLY=( $(compgen -f -- "${cur}") )
            return 0
            ;;
        -d|--dest)
            COMPREPLY=( $(compgen -d -- "${cur}") )
            return 0
            ;;
        --completion)
            COMPREPLY=( $(compgen -W "zsh bash" -- "${cur}") )
            return 0
            ;;
        *)
            ;;
    esac

    if [[ ${cur} == -* ]] ; then
        COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )
        return 0
    fi
}
complete -F _mle_completion main.py python
"""

if "--completion" in sys.argv:
    idx = sys.argv.index("--completion")
    shell_type = "zsh"
    if idx + 1 < len(sys.argv) and sys.argv[idx + 1] in ["zsh", "bash"]:
        shell_type = sys.argv[idx + 1]
    if shell_type == "zsh":
        print(ZSH_COMPLETION.strip())
    else:
        print(BASH_COMPLETION.strip())
    sys.exit(0)

import aiohttp
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright


async def get_fuckingfast_link(session, download_url):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    }
    async with session.get(download_url, headers=headers) as response:
        response_text = await response.text()
        soup = BeautifulSoup(response_text, "html.parser")
        scripts = soup.find_all("script")
        pattern = re.compile(r"https://fuckingfast.co/dl/[a-zA-Z0-9_-]+")
        for script in scripts:
            if script.string:
                match = pattern.search(script.string)
                if match:
                    return match.group()
    return None


async def get_datanodes_link(browser, download_url):
    page = await browser.new_page()
    try:
        await page.goto(download_url, wait_until="networkidle", timeout=60000)

        # Wait for verification to complete (button enabled = file ready)
        await page.wait_for_selector(
            "button#method_free:not([disabled])", timeout=120000
        )

        # Full fetch-only flow: get reCAPTCHA token → submit op=download1 → submit op=download2 → parse JSON
        result = await page.evaluate("""async () => {
            const token = await new Promise((resolve) => {
                grecaptcha.ready(() => {
                    grecaptcha.execute('6LdhelkqAAAAAH_f47GPnSuEgnjRo4Pf0ukRioGs', {action: 'submit'}).then(resolve);
                });
            });

            const form = document.getElementById('downloadForm');
            const baseData = new FormData(form);

            // Step 1: op=download1
            const fd1 = new FormData(form);
            fd1.set('g-recaptcha-response', token);
            const r1 = await fetch('/download', { method: 'POST', body: fd1 });
            if (!r1.ok) return { error: 'download1 failed: ' + r1.status };

            // Step 2: op=download2
            const fd2 = new FormData(form);
            fd2.set('op', 'download2');
            fd2.set('method_free', 'Free Download >>');
            fd2.set('g_captch__a', '1');
            fd2.set('g-recaptcha-response', token);
            const r2 = await fetch('/download', { method: 'POST', body: fd2 });
            if (!r2.ok) return { error: 'download2 failed: ' + r2.status };

            const json = await r2.json();
            return json;
        }""")

        if isinstance(result, dict) and "url" in result:
            return unquote(result["url"])
        return None
    finally:
        await page.close()


async def process_links(urls):
    async with aiohttp.ClientSession() as session, async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--no-sandbox"])
        results = []
        total_urls = len(urls)
        successful = 0
        failed_urls = []

        start_time = time.time()

        print(f"[*] Processing {total_urls} URLs...")

        for index, url in enumerate(urls):
            url = url.strip()
            if url:
                parsed_url = urlparse(url)
                download_link = None
                service_name = ""

                if "fuckingfast.co" in parsed_url.netloc:
                    service_name = "Fuckingfast"
                    progress = f"  [{index + 1}/{total_urls}] {service_name}"
                    print(progress)
                    download_link = await get_fuckingfast_link(session, url)
                elif "datanodes.to" in parsed_url.netloc:
                    service_name = "Datanodes"
                    progress = f"  [{index + 1}/{total_urls}] {service_name}"
                    print(progress)
                    download_link = await get_datanodes_link(browser, url)

                if download_link:
                    successful += 1
                    print(f"  ✓ {service_name} link extracted")
                else:
                    failed_urls.append(url)
                    print(f"  ✗ Failed to extract {service_name} link")

                results.append(
                    {
                        "original_url": url,
                        "download_link": download_link,
                        "success": download_link is not None,
                        "service": service_name,
                    }
                )

        elapsed_time = time.time() - start_time

        return {
            "results": results,
            "stats": {
                "total": total_urls,
                "successful": successful,
                "failed": total_urls - successful,
                "success_rate": (successful / total_urls * 100)
                if total_urls > 0
                else 0,
                "elapsed_time": elapsed_time,
                "failed_urls": failed_urls,
            },
        }


async def download_file(session, url, dest_folder):
    filename = None
    try:
        if not os.path.exists(dest_folder):
            os.makedirs(dest_folder, exist_ok=True)

        async with session.get(url, allow_redirects=True) as resp:
            if resp.status != 200:
                return None, f"HTTP {resp.status}"

            cd = resp.headers.get("Content-Disposition", "")
            m = re.search(r'filename\*?=(?:UTF-8\'\')?["\']?([^"\';]+)["\']?', cd)
            if m:
                filename = unquote(m.group(1))
            else:
                filename = url.rstrip("/").split("/")[-1].split("?")[0]
                if not filename:
                    filename = f"download_{int(time.time())}"

            filepath = os.path.join(dest_folder, filename)
            total = int(resp.headers.get("Content-Length", 0))
            downloaded = 0

            with open(filepath, "wb") as f:
                async for chunk in resp.content.iter_chunked(65536):
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total:
                        pct = downloaded * 100 / total
                        bar_len = 30
                        filled = int(bar_len * downloaded / total)
                        bar = "█" * filled + "░" * (bar_len - filled)
                        sys.stdout.write(
                            f"\r    {bar} {downloaded // 1024 // 1024}MB/{total // 1024 // 1024}MB ({pct:.1f}%)"
                        )
                        sys.stdout.flush()
            print()
            return filepath, None
    except Exception as e:
        return None, str(e)


def collect_urls(args):
    urls = []

    # 1. From CLI positional arguments
    if args.urls:
        urls.extend([u.strip() for u in args.urls if u.strip()])

    # 2. From specified file
    if args.file:
        if os.path.exists(args.file):
            with open(args.file, "r", encoding="utf-8") as f:
                urls.extend([line.strip() for line in f if line.strip()])
        else:
            print(f"[!] Error: Input file '{args.file}' not found.", file=sys.stderr)
            sys.exit(1)

    # 3. From Stdin / Pipeline if piped
    if not urls and not sys.stdin.isatty():
        for line in sys.stdin:
            line = line.strip()
            if line:
                urls.append(line)

    # 4. Fallback: Check if default links.txt exists
    if not urls and os.path.exists("links.txt"):
        with open("links.txt", "r", encoding="utf-8") as f:
            file_urls = [line.strip() for line in f if line.strip()]
            if file_urls:
                print(f"[*] Loaded {len(file_urls)} URL(s) from 'links.txt'.")
                return file_urls

    # 5. Fallback: Interactive input
    if not urls and sys.stdin.isatty():
        print(
            "[*] No URLs provided. Paste or enter URLs (Press Enter on empty line or Ctrl+D to start):"
        )
        try:
            while True:
                line = input("> ").strip()
                if not line:
                    break
                urls.append(line)
        except EOFError:
            pass

    return urls


def main():
    parser = argparse.ArgumentParser(
        description="MultiLinkExtractor: Fast direct download link extraction & automated downloader for FuckingFast and DataNodes.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Examples:
  python main.py https://fuckingfast.co/xxx https://datanodes.to/yyy
  python main.py -f links.txt -d ./downloads
  python main.py -f links.txt --extract-only -o direct_links.txt
  cat links.txt | python main.py
  python main.py --completion zsh > ~/.zfunc/_mle
""",
    )

    parser.add_argument(
        "urls",
        nargs="*",
        help="One or more URLs to extract and download.",
    )
    parser.add_argument(
        "-f",
        "--file",
        type=str,
        help="Path to file containing URLs (one per line).",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=str,
        default=None,
        help="Path to output file for extracted direct links (only saved if this option is specified).",
    )
    parser.add_argument(
        "-d",
        "--dest",
        type=str,
        default=".",
        help="Destination directory for downloaded files (default: current directory).",
    )
    parser.add_argument(
        "-e",
        "--extract-only",
        "--no-download",
        dest="extract_only",
        action="store_true",
        help="Extract direct links only without downloading files.",
    )
    parser.add_argument(
        "--completion",
        type=str,
        nargs="?",
        const="zsh",
        choices=["zsh", "bash"],
        help="Generate shell completion script (default: zsh).",
    )

    args = parser.parse_args()

    urls = collect_urls(args)

    if not urls:
        print(
            "[!] No URLs provided to process. Use -h or --help for usage information."
        )
        sys.exit(1)

    print(f"[*] Starting extraction for {len(urls)} URL(s)...")
    result_data = asyncio.run(process_links(urls))

    stats = result_data["stats"]

    print()
    print("─── Summary ───────────────────────────────────────")
    print(f"  Total URLs:     {stats['total']}")
    print(f"  Successful:     {stats['successful']}")
    print(f"  Failed:         {stats['failed']}")
    print(f"  Success rate:   {stats['success_rate']:.2f}%")
    print(f"  Time elapsed:   {stats['elapsed_time']:.2f}s")
    print("───────────────────────────────────────────────────")

    if stats["failed"] > 0:
        print()
        print("FAILED URLS:")
        for i, failed_url in enumerate(stats["failed_urls"], 1):
            print(f"  {i}. {failed_url}")

    # Service-specific stats
    service_stats = {}
    for result in result_data["results"]:
        service = result["service"]
        if service not in service_stats:
            service_stats[service] = {"total": 0, "success": 0, "failed": 0}
        service_stats[service]["total"] += 1
        if result["success"]:
            service_stats[service]["success"] += 1
        else:
            service_stats[service]["failed"] += 1

    if service_stats:
        print()
        print("─── Per service ──────────────────────────────────")
        for service, s_stats in service_stats.items():
            success_rate = (
                (s_stats["success"] / s_stats["total"]) * 100
                if s_stats["total"] > 0
                else 0
            )
            print(
                f"  {service}: {s_stats['success']}/{s_stats['total']} ({success_rate:.2f}%)"
            )

    # Only save to output file if user explicitly requested with -o / --output
    if args.output:
        try:
            with open(args.output, "w", encoding="utf-8") as output_file:
                for item in result_data["results"]:
                    if item["download_link"]:
                        output_file.write(f"{item['download_link']}\n")
            print(f"\n[*] Direct download links saved to: {args.output}")
        except Exception as e:
            print(
                f"\n[!] Error saving output file '{args.output}': {e}", file=sys.stderr
            )

    # Download files unless --extract-only / --no-download is specified
    if not args.extract_only:
        valid_downloads = [r for r in result_data["results"] if r["download_link"]]
        if not valid_downloads:
            print("\n[!] No valid download links extracted. Skipping download.")
            return

        print()
        print(
            f"─── Downloading {len(valid_downloads)} file(s) to '{args.dest}' ──────────────────"
        )

        async def run_downloads():
            async with aiohttp.ClientSession(
                headers={"User-Agent": "Mozilla/5.0"}
            ) as session:
                total_files = len(valid_downloads)
                dl_ok = 0
                dl_fail = 0
                for i, item in enumerate(valid_downloads):
                    fname = unquote(
                        item["download_link"].rstrip("/").split("/")[-1].split("?")[0]
                    )
                    print(f"\n  [{i + 1}/{total_files}] {fname}")
                    path, err = await download_file(
                        session, item["download_link"], args.dest
                    )
                    if path:
                        dl_ok += 1
                        print(f"  ✓ Saved: {os.path.basename(path)}")
                    else:
                        dl_fail += 1
                        print(f"  ✗ Failed: {err}")

                print(f"\n  Downloaded: {dl_ok}/{total_files}  Failed: {dl_fail}")

        asyncio.run(run_downloads())


if __name__ == "__main__":
    main()
