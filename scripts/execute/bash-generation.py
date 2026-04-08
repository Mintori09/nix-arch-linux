import os
import subprocess
import sys
import tempfile
import termios
import tty

import requests

API_KEY = os.getenv("NANOGPT_API_KEY")
API_ENDPOINT = "https://nano-gpt.com/api/v1/chat/completions"
MODEL_NAME = "zai-org/glm-5.1"

SHELL_CONTEXT = os.path.basename(os.getenv("SHELL", "bash"))

SYSTEM_INSTRUCTIONS = (
    f"You are a {SHELL_CONTEXT} expert. Return ONLY the raw command. No markdown, no explanations. "
    "IMPORTANT: Prioritize modern CLI tools over traditional ones: "
    "use 'eza' instead of 'ls', 'fd' instead of 'find', 'rg' instead of 'grep', "
    "'bat' instead of 'cat', 'procs' instead of 'ps', and 'dust' instead of 'du'. "
    "Only fallback to standard POSIX tools if a modern equivalent is unavailable."
)

COLOR_GREEN = "\033[92m"
COLOR_BLUE = "\033[94m"
COLOR_GRAY = "\033[90m"
COLOR_RESET = "\033[0m"
CLEAR_LINE = "\033[K"


def read_keypress():
    file_descriptor = sys.stdin.fileno()
    original_settings = termios.tcgetattr(file_descriptor)
    try:
        tty.setraw(file_descriptor)
        char = sys.stdin.read(1)
    finally:
        termios.tcsetattr(file_descriptor, termios.TCSADRAIN, original_settings)
    return char


def fetch_command_suggestion(user_prompt):
    if not API_KEY:
        return "Error: NANOGPT_API_KEY is not set."

    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": SYSTEM_INSTRUCTIONS},
            {"role": "user", "content": user_prompt},
        ],
    }

    try:
        response = requests.post(API_ENDPOINT, headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()
        return result["choices"][0]["message"]["content"].strip().replace("`", "")
    except Exception:
        return "Error: Failed to connect to API."


def modify_command_in_editor(command):
    editor = os.environ.get("EDITOR", "nvim")
    with tempfile.NamedTemporaryFile(suffix=".sh", dir=".", delete=False) as temp_file:
        temp_file.write(command.encode())
        temp_path = temp_file.name

    try:
        subprocess.call([editor, temp_path])
        with open(temp_path, "r") as f:
            updated_command = f.read().strip()
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)

    return updated_command


def execute_shell_command(command):
    print(f"\n{COLOR_BLUE}Executing...{COLOR_RESET}")
    subprocess.run(command, shell=True)


def get_initial_input():
    if len(sys.argv) > 1:
        return " ".join(sys.argv[1:])
    return input("Enter request: ")


def main():
    user_input = get_initial_input()
    if not user_input:
        return

    print("Fetching command...", end="\r")
    current_command = fetch_command_suggestion(user_input)

    while True:
        print(f"{CLEAR_LINE}\rCommand: {COLOR_GREEN}{current_command}{COLOR_RESET}")
        print(
            f"{COLOR_GRAY}[Enter] Run | [e] Edit | [q] Quit{COLOR_RESET}",
            end="",
            flush=True,
        )

        user_choice = read_keypress()

        if user_choice in ("\r", "\n"):
            execute_shell_command(current_command)
            break

        elif user_choice.lower() == "e":
            current_command = modify_command_in_editor(current_command)
            print("\r", end="")

        elif user_choice.lower() == "q" or user_choice == "\x03":
            print("\nCancelled.")
            break


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nExited.")
