#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.."

FILE_1="$HOME/.config/home-manager/scripts/execute/convert-file.js"
FILE_2="$HOME/.config/home-manager/modules/scripts/completions/_cv"

BACKUP_1="${FILE_1}.bak"
BACKUP_2="${FILE_2}.bak"

uncopy() {
	echo "Deployment failed! Rolling back to previous configuration..."

	if [ -f "$BACKUP_1" ]; then
		mv "$BACKUP_1" "$FILE_1"
		echo "Restored: $FILE_1"
	fi

	if [ -f "$BACKUP_2" ]; then
		mv "$BACKUP_2" "$FILE_2"
		echo "Restored: $FILE_2"
	fi
}

copy_to_nix() {
	local filepath="$1"
	local distpath="$2"
	local backuppath="$3"

	if [ -f "$distpath" ]; then
		cp "$distpath" "$backuppath"
	fi

	cp "$filepath" "$distpath"
	diff "$filepath" "$distpath"
	echo "Successfully copied and verified: $filepath -> $distpath"
}

cleanup_backups() {
	rm -f "$BACKUP_1" "$BACKUP_2"
}

main() {
	trap uncopy ERR SIGINT SIGTERM

	cd "$PROJECT_ROOT"

	pnpm build

	copy_to_nix "$PROJECT_ROOT/dist/index.js" "$FILE_1" "$BACKUP_1"
	copy_to_nix "$PROJECT_ROOT/completions/_cv" "$FILE_2" "$BACKUP_2"

	echo "Running home-manager switch..."
	home-manager switch --flake ~/.config/home-manager

	cleanup_backups
	echo "Deployment completed successfully!"
}

main "$@"
