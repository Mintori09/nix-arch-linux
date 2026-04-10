import json
import os
import subprocess
import sys
import tempfile
import termios
import tty
from pathlib import Path

import requests

CACHE_FILE = Path.home() / ".local/.cmd_ai_cache.jsonl"
API_KEY = os.getenv("NANOGPT_API_KEY")
API_ENDPOINT = "https://nano-gpt.com/api/v1/chat/completions"
FALLBACK_MODELS = [
    "zai-org/glm-5",
    "moonshotai/kimi-k2.5",
    "qwen/qwen3.5-397b-a17b",
    "deepseek-r1",
]
SHELL_NAME = os.path.basename(os.getenv("SHELL", "zsh"))

# Color
COLOR_BLUE = "\033[94m"
COLOR_GRAY = "\033[90m"
COLOR_GREEN = "\033[92m"
COLOR_BOLD = "\033[1m"
COLOR_RESET = "\033[0m"
CLEAR_LINE = "\033[K"


def save_to_cache(prompt, command):
    if not command or "Error" in command:
        return
    entries = []
    if CACHE_FILE.exists():
        with open(CACHE_FILE, "r") as f:
            for line in f:
                try:
                    data = json.loads(line)
                    if data["command"] != command:
                        entries.append(line)
                except:
                    continue

    with open(CACHE_FILE, "w") as f:
        for e in entries:
            f.write(e)
        f.write(json.dumps({"prompt": prompt, "command": command}) + "\n")


def search_with_fzf():
    if not CACHE_FILE.exists() or CACHE_FILE.stat().st_size == 0:
        return None

    with open(CACHE_FILE, "r") as f:
        lines = [json.loads(l) for l in f.readlines()]

    formatted_input = "\n".join(
        [f"{item['prompt']} \t {item['command']}" for item in reversed(lines)]
    )

    fzf_cmd = [
        "fzf",
        "--ansi",
        "--header",
        "Enter: Select | Ctrl-X: Delete | Esc: New Prompt",
        "--delimiter",
        "\t",
        "--with-nth",
        "1",
        "--preview",
        "echo {2} | bat --style=plain --color=always -l bash",
        "--preview-window",
        "bottom:3:wrap",
        "--bind",
        "ctrl-x:execute(sed -i '||{2}||d' "
        + str(CACHE_FILE)
        + ")+reload(cat "
        + str(CACHE_FILE)
        + ")",
    ]

    try:
        proc = subprocess.Popen(
            fzf_cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True
        )
        stdout, _ = proc.communicate(input=formatted_input)

        if stdout:
            return stdout.split("\t")[1].strip()
    except Exception:
        pass
    return None


def fetch_command_suggestion(user_prompt):
    if not API_KEY:
        return "Error: API Key missing."
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

    for model in FALLBACK_MODELS:
        try:
            print(f"{COLOR_GRAY}Calling {model}...{COLOR_RESET}", end="\r")
            payload = {
                "model": model,
                "messages": [
                    {
                        "role": "system",
                        "content": f"You are a {SHELL_NAME} expert. Return ONLY the raw command. No markdown.",
                    },
                    {"role": "user", "content": user_prompt},
                ],
                "stream": True,
            }
            response = requests.post(
                API_ENDPOINT, headers=headers, json=payload, timeout=10, stream=True
            )
            content = ""
            for line in response.iter_lines():
                line = line.decode("utf-8")
                if line.startswith("data: "):
                    if "[DONE]" in line:
                        break
                    try:
                        content += json.loads(line[6:])["choices"][0]["delta"].get(
                            "content", ""
                        )
                    except:
                        continue
            return content.strip().replace("`", "")
        except:
            continue
    return "Error: All models failed."


def read_keypress():
    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        return sys.stdin.read(1)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)


def main():
    user_prompt = " ".join(sys.argv[1:])
    current_command = None

    if user_prompt:
        current_command = fetch_command_suggestion(user_prompt)
        save_to_cache(user_prompt, current_command)
    else:
        current_command = search_with_fzf()
        if not current_command:
            user_prompt = input(f"{COLOR_BOLD}Enter request:{COLOR_RESET} ")
            if not user_prompt:
                return
            current_command = fetch_command_suggestion(user_prompt)
            save_to_cache(user_prompt, current_command)

    while True:
        if not current_command or "Error" in current_command:
            print(f"\n{current_command}")
            break

        print(f"{CLEAR_LINE}\r{COLOR_BOLD}Generated Bash:{COLOR_RESET}")
        print(f"  {COLOR_GREEN}{current_command}{COLOR_RESET}")
        print(
            f"{COLOR_GRAY}[Enter] Run | [e] Edit | [q] Quit{COLOR_RESET}",
            end="",
            flush=True,
        )

        key = read_keypress()
        if key in ("\r", "\n"):
            print(f"\n{COLOR_BLUE}➜ Executing...{COLOR_RESET}")
            subprocess.run(current_command, shell=True)
            break
        elif key.lower() == "e":
            editor = os.environ.get("EDITOR", "nano")
            with tempfile.NamedTemporaryFile(suffix=".sh", delete=False) as tf:
                tf.write(current_command.encode())
                path = tf.name
            subprocess.call([editor, path])
            with open(path, "r") as f:
                current_command = f.read().strip()
            os.unlink(path)
            print("\033[F\033[F", end="")
        elif key.lower() in ("q", "\x03"):
            print("\nCancelled.")
            break


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nExited.")
