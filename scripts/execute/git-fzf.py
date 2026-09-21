#!/usr/bin/env python3

import subprocess
import re
from typing import Optional
import argparse
import os

GITLOG_PATH = os.path.abspath(__file__)

USAGE_DOC = """
Usage:
    gitlog [--opencommitlink <shorthash>] [--copydiff <shorthash>] [--copyhash <shorthash>] [<git-log-options>...]

Examples:
    gitlog --all
    gitlog --since="2 weeks ago" --author="John Doe"
    gitlog --opencommitlink abc1234
    gitlog --copydiff abc1234
"""

def notify(msg: str) -> None:
    if os.environ.get("WAYLAND_DISPLAY") or os.environ.get("DISPLAY"):
        subprocess.run(
            ['notify-send', '-u', 'low', '-t', '2500', '-a', 'git-fzf', 'Git Diff Copied', msg],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )

def copy_to_clipboard(text: str) -> bool:
    for cmd in [['wl-copy'], ['xclip', '-selection', 'clipboard'], ['xsel', '--clipboard', '--input']]:
        try:
            p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
            p.communicate(input=text.encode('utf-8'))
            if p.returncode == 0:
                return True
        except FileNotFoundError:
            continue
    return False

def copy_commit_diff(shorthash: str) -> None:
    result = subprocess.run(['git', 'show', shorthash], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode == 0 and result.stdout:
        diff_text = result.stdout.decode('utf-8', errors='replace')
        if copy_to_clipboard(diff_text):
            notify(f"Diff for {shorthash} copied to clipboard")
        else:
            print(f"Error: No clipboard utility found (wl-copy, xclip, xsel).")

def copy_commit_hash(shorthash: str) -> None:
    if copy_to_clipboard(shorthash):
        notify(f"Commit {shorthash} copied to clipboard")

def gitlog(*args: str) -> None:
    git_cmd = [
        'git', 'log', '--graph', '--color=always', '--format=%C(auto)%h%d %s %C(bold green)%ar %C(dim white)%an'
    ] + list(args or [])
    
    # Usage:
    # -   ctrl-m: page the commit
    # -   ctrl-l: open the commit link
    # -   ctrl-y / y: copy the full commit diff to clipboard
    # -   alt-y: copy the commit short hash to clipboard
    # See [ref](https://gist.github.com/junegunn/f4fca918e937e6bf5bad?permalink_comment_id=2731105#gistcomment-2731105)
    fzf_cmd = [
        'fzf', '--ansi', '--no-sort', '--reverse', '--tiebreak=index', '--no-multi',
        '--preview', 'f() { set -- $(echo -- "$@" | grep -o "[a-f0-9]\\{7\\}"); [ $# -eq 0 ] || git show --color=always $1 ; }; f {}',
        '--preview-window=right:60%:hidden',
        '--bind', 'ctrl-j:down,ctrl-k:up',
        '--bind', 'ctrl-f:page-down,ctrl-b:page-up',
        '--bind', 'alt-j:preview-down,alt-k:preview-up',
        '--bind', 'alt-f:preview-page-down,alt-b:preview-page-up',
        '--bind', 'ctrl-/:toggle-preview',
        '--bind', 'ctrl-u:track+clear-query',
        '--bind', 'q:abort',
        '--bind', 'ctrl-m:execute:(echo {} | grep -o "[a-f0-9]\\{7\\}" | head -1 | xargs -I @ sh -c \'git show --color=always @ | command bat --number\')',
        '--bind', 'ctrl-l:execute-silent:(echo {} | grep -o "[a-f0-9]\\{7\\}" | head -1 | xargs -I @ ' + GITLOG_PATH + ' --opencommitlink @)',
        '--bind', 'ctrl-y:execute-silent:(echo {} | grep -o "[a-f0-9]\\{7\\}" | head -1 | xargs -I @ ' + GITLOG_PATH + ' --copydiff @)',
        '--bind', 'alt-y:execute-silent:(echo {} | grep -o "[a-f0-9]\\{7\\}" | head -1 | xargs -I @ ' + GITLOG_PATH + ' --copyhash @)',
    ]

    # Run git log command and pipe to fzf
    process = subprocess.Popen(git_cmd, stdout=subprocess.PIPE)
    subprocess.run(fzf_cmd, stdin=process.stdout)
    process.wait()

def commit_link(shorthash: str) -> Optional[str]:
    # get fullhash
    fullhash = subprocess.run(['git', 'rev-parse', shorthash], stdout=subprocess.PIPE).stdout.decode().strip()
    if not fullhash:
        print(f"Invalid commit hash: {shorthash}")
        return None

    # get the remote URL
    remote_url = subprocess.run(['git', 'config', '--get', 'remote.origin.url'], stdout=subprocess.PIPE).stdout.decode().strip()
    if not remote_url:
        print("Could not determine remote URL")
        return None

    # parse the remote URL
    match = re.search(r'(?:://|@)([^/:]+)[:/](.+)\.git', remote_url)
    if not match:
        print("Could not determine repository or host")
        return None

    host = match.group(1)
    repo = match.group(2)

    return f"https://{host}/{repo}/commit/{fullhash}"

def open_commit_link(shorthash: str) -> None:
    link = commit_link(shorthash)
    if link:
        subprocess.run(['xdg-open', link], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def main() -> None:
    parser = argparse.ArgumentParser(
        description="A script to display git logs and open commit links.",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog=USAGE_DOC
    )
    parser.add_argument('--opencommitlink', type=str, help="Open the commit link for the given short hash.")
    parser.add_argument('--copydiff', type=str, help="Copy the full diff of the given short hash to clipboard.")
    parser.add_argument('--copyhash', type=str, help="Copy the short hash to clipboard.")
    known_args, other_args = parser.parse_known_args()

    if known_args.opencommitlink:
        open_commit_link(known_args.opencommitlink)
    elif known_args.copydiff:
        copy_commit_diff(known_args.copydiff)
    elif known_args.copyhash:
        copy_commit_hash(known_args.copyhash)
    else:
        gitlog(*other_args)

if __name__ == "__main__":
    main()

