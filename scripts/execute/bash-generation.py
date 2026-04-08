import os
import subprocess
import sys
import tempfile
import termios
import tty

import requests

# --- CONFIGURATION ---
API_KEY = os.getenv("NANOGPT_API_KEY")
BASE_URL = "https://nano-gpt.com/api/v1"
MODEL_ID = "zai-org/glm-5.1"


def get_char():
    """Captures a single keystroke immediately without requiring Enter."""
    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    try:
        tty.setraw(sys.stdin.fileno())
        ch = sys.stdin.read(1)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
    return ch


def get_ai_command(user_prompt):
    """Sends the request to the AI and retrieves the suggested command."""
    if not API_KEY:
        return "Error: NANOGPT_API_KEY is not set."

    shell_name = os.path.basename(os.getenv("SHELL", "bash"))
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

    # Updated prompt to prioritize modern CLI tools
    system_instructions = (
        f"You are a {shell_name} expert. Return ONLY the raw command. No markdown, no explanations. "
        "IMPORTANT: Prioritize modern CLI tools over traditional ones: "
        "use 'eza' instead of 'ls', 'fd' instead of 'find', 'rg' instead of 'grep', "
        "'bat' instead of 'cat', 'procs' instead of 'ps', and 'dust' instead of 'du'. "
        "Only fallback to standard POSIX tools if a modern equivalent is unavailable."
    )

    payload = {
        "model": MODEL_ID,
        "messages": [
            {
                "role": "system",
                "content": system_instructions,
            },
            {"role": "user", "content": user_prompt},
        ],
    }
    try:
        res = requests.post(
            f"{BASE_URL}/chat/completions", headers=headers, json=payload
        ).json()
        return res["choices"][0]["message"]["content"].strip().replace("`", "")
    except Exception:
        return "Error: Failed to connect to API."


def edit_in_editor(cmd):
    """Opens the default editor with a temporary file in the current directory."""
    editor = os.environ.get("EDITOR", "nano")
    with tempfile.NamedTemporaryFile(suffix=".sh", dir=".", delete=False) as tf:
        tf.write(cmd.encode())
        path = tf.name

    subprocess.call([editor, path])

    with open(path, "r") as f:
        new_cmd = f.read().strip()

    if os.path.exists(path):
        os.unlink(path)
    return new_cmd


def main():
    user_input = (
        " ".join(sys.argv[1:]) if len(sys.argv) > 1 else input("Enter request: ")
    )
    if not user_input:
        return

    print("Fetching command...", end="\r")
    command = get_ai_command(user_input)

    while True:
        print("\033[K", end="")
        print(f"\rCommand: \033[92m{command}\033[0m")
        print(
            "\033[90m[Enter] Run | [e] Edit | [q] Quit\033[0m",
            end="",
            flush=True,
        )

        char = get_char()

        if char in ("\r", "\n"):
            print("\n\033[94m➜ Executing...\033[0m")
            subprocess.run(command, shell=True)
            break
        elif char.lower() == "e":
            command = edit_in_editor(command)
            print("\r", end="")
        elif char.lower() == "q" or char == "\x03":
            print("\nCancelled.")
            break


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nExited.")
