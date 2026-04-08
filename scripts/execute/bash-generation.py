import os
import subprocess
import sys

import requests

# Get Key and Model
API_KEY = os.getenv("NANOGPT_API_KEY")
API_URL = "https://api.nanogpt.com/v1/chat/completions"
MODEL_ID = "qwen/qwen3-coder"


def get_recommendation(user_prompt, previous_cmd="None"):
    if not API_KEY:
        print("\033[91mError: NANOGPT_API_KEY not set.\033[0m")
        sys.exit(1)

    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

    # Strict instructions for the LLM
    system_prompt = "You are a bash assistant. Return ONLY the raw bash command. No markdown, no backticks."
    refined_prompt = f"Context: Previous command was '{previous_cmd}'. User needs: '{user_prompt}'. Provide the best bash command:"

    data = {
        "model": MODEL_ID,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": refined_prompt},
        ],
        "temperature": 0,
    }

    try:
        response = requests.post(API_URL, json=data, headers=headers)
        response.raise_for_status()
        # Remove any lingering markdown symbols
        return (
            response.json()["choices"][0]["message"]["content"].strip().replace("`", "")
        )
    except Exception as e:
        return f"Error connecting to NanoGPT: {e}"


def main():
    # 1. Grab initial prompt from command line args (if any)
    # e.g., 'python gen.py list all docker containers'
    initial_input = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else None
    current_command = "None"

    print("\033[94m--- NanoGPT Bash Gen (Ctrl+C to quit) ---\033[0m")

    while True:
        try:
            if initial_input:
                user_input = initial_input
                initial_input = None  # Use only once
            else:
                user_input = input("\nDescribe task (or 'run'): ").strip()

            if not user_input:
                continue

            # Execution Logic
            if user_input.lower() == "run":
                if current_command != "None":
                    print("\033[1;33mExecuting...\033[0m")
                    subprocess.run(current_command, shell=True)
                    break
                continue

            # Generation Logic
            print(f"Requesting {MODEL_ID}...")
            current_command = get_recommendation(user_input, current_command)

            print(f"\nProposed: \033[1;32m{current_command}\033[0m")
            print("Action: Enter a new prompt to fix it, or type 'run' to execute.")

        except KeyboardInterrupt:
            print("\n\033[91mCanceled.\033[0m")
            sys.exit(0)


if __name__ == "__main__":
    main()
