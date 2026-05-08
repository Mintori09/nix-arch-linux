#!/usr/bin/env python3
"""
each: apply a shell command to every item read from stdin.

Best for pipelines like:
  cat reddit-links.txt | each 'echo {}'
  cat reddit-links.txt | each 'open {}'
  cat reddit-links.txt | each 'curl -L {} -o page_{n}.html'
  cat reddit-links.txt | each --dry-run 'yt-dlp {}'

Input examples:
  line mode:        one URL/string per line
  whitespace mode: split by any whitespace
  blank mode:      split paragraphs by blank lines
  json mode:       parse JSON array

Placeholders:
  {}      current item, shell-quoted by default
  {raw}   current item without quoting
  {n}     1-based item number
  {i}     0-based item number

Safety:
  {} is shell-quoted by default.
  {raw} intentionally disables quoting, so only use it with trusted input.
"""

from __future__ import annotations

import argparse
import json
import shlex
import subprocess
import sys
from dataclasses import dataclass
from typing import Any, Iterable, List


@dataclass(frozen=True)
class Item:
    value: str
    number: int

    @property
    def index(self) -> int:
        return self.number - 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="each",
        description="Read stdin and run a command template once for each parsed item.",
    )
    parser.add_argument(
        "command",
        help="Command template. Use {} for shell-quoted item, {raw} for raw item, {n} for 1-based number.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Parse stdin as a JSON array instead of splitting text.",
    )
    parser.add_argument(
        "--split",
        choices=("line", "whitespace", "blank", "none"),
        default="line",
        help="How to split stdin when --json is not used. Default: line.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print expanded commands instead of executing them.",
    )
    parser.add_argument(
        "--fail-fast",
        action="store_true",
        help="Stop immediately when a command exits with non-zero status.",
    )
    parser.add_argument(
        "--keep-empty",
        action="store_true",
        help="Keep empty text items when splitting stdin.",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Do not print progress lines before each command.",
    )
    return parser.parse_args()


def stringify_json_item(item: Any) -> str:
    if isinstance(item, str):
        return item
    return json.dumps(item, ensure_ascii=False, separators=(",", ":"))


def parse_stdin(
    text: str, use_json: bool, split_mode: str, keep_empty: bool
) -> List[str]:
    if use_json:
        try:
            value = json.loads(text)
        except json.JSONDecodeError as exc:
            raise SystemExit(f"Invalid JSON stdin: {exc}") from exc

        if not isinstance(value, list):
            raise SystemExit("JSON stdin must be an array.")

        return [stringify_json_item(item) for item in value]

    if split_mode == "none":
        items = [text]
    elif split_mode == "line":
        items = text.splitlines()
    elif split_mode == "whitespace":
        items = text.split()
    elif split_mode == "blank":
        normalized = text.replace("\r\n", "\n").replace("\r", "\n")
        items = split_by_blank_lines(normalized, keep_empty)
    else:
        raise SystemExit(f"Unsupported split mode: {split_mode}")

    if keep_empty:
        return items
    return [item.strip() for item in items if item.strip()]


def split_by_blank_lines(text: str, keep_empty: bool) -> List[str]:
    blocks: List[str] = []
    current: List[str] = []

    for line in text.split("\n"):
        if line.strip() == "":
            if current or keep_empty:
                blocks.append("\n".join(current))
                current = []
        else:
            current.append(line)

    if current or keep_empty:
        blocks.append("\n".join(current))

    return blocks


def make_items(values: Iterable[str]) -> List[Item]:
    return [
        Item(value=value, number=number) for number, value in enumerate(values, start=1)
    ]


def render_command(template: str, item: Item) -> str:
    quoted_value = shlex.quote(item.value)
    command = template.replace("{}", quoted_value)
    command = command.replace("{raw}", item.value)
    command = command.replace("{n}", str(item.number))
    command = command.replace("{i}", str(item.index))

    if command == template:
        command = f"{template} {quoted_value}"

    return command


def run_commands(items: Iterable[Item], args: argparse.Namespace) -> int:
    final_code = 0

    for item in items:
        command = render_command(args.command, item)

        if args.dry_run:
            print(command)
            continue

        if not args.quiet:
            print(f"[{item.number}] $ {command}", file=sys.stderr)

        result = subprocess.run(command, shell=True)
        if result.returncode != 0:
            final_code = result.returncode
            print(
                f"each: command failed for item #{item.number} with exit code {result.returncode}",
                file=sys.stderr,
            )
            if args.fail_fast:
                return result.returncode

    return final_code


def main() -> int:
    args = parse_args()
    stdin_text = sys.stdin.read()
    values = parse_stdin(stdin_text, args.json, args.split, args.keep_empty)
    items = make_items(values)
    return run_commands(items, args)


if __name__ == "__main__":
    raise SystemExit(main())
