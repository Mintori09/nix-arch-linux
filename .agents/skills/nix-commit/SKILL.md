---
name: nix:commit
description: Autonomously commit Nix/Home Manager changes and all source files belonging to Nix-managed features.
---

# Nix Commit

When asked to commit Nix/Home Manager changes, act autonomously.

- Determine scope by **feature and dependency**, not file extension.
- Include `.nix`, `flake.nix`, `flake.lock`, Home Manager modules, and any scripts/source code managed, packaged, installed, or referenced by the Nix configuration.
- For example, if Nix manages `packages/cv-cli`, its TypeScript source is part of the Nix change and should be committed.
- Inspect `git status` and the diff before staging.
- Ignore genuinely unrelated changes, but do not assume non-Nix files are unrelated.
- Group changes into logical, self-contained commits. Keep configuration and its implementation together.
- Automatically split unrelated features into separate commits.
- Never ask the user which files to stage, how to split commits, or which commit message to use. Make the decision yourself.
- Preserve unrelated working-tree changes.
- Never use `git add -A`, `git add .`, `git reset --hard`, or discard user changes.
- Validate relevant Nix changes with the repository's normal checks, such as `nix flake check` when appropriate.
- Review the staged diff before committing.
- Use concise Conventional Commit messages such as `feat(nix): ...`, `fix(nix): ...`, `feat(zsh): ...`, or `refactor(home-manager): ...`.
- After each commit, inspect the remaining changes and continue committing relevant logical changes until the requested Nix work is complete.
- Only ask the user when the intent is genuinely ambiguous and cannot be inferred from the repository.

The default behavior is:

inspect → classify → group → validate → stage → review → commit → continue

Do not stop to ask for confirmation during this workflow.

