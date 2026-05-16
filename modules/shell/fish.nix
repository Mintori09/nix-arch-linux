{ pkgs, ... }:

let
  c = import ./_constants.nix;
in
{
  programs.fish = {
    enable = true;

    plugins = [
      {
        name = "fzf-fish";
        src = pkgs.fishPlugins.fzf-fish;
      }
      {
        name = "puffer";
        src = pkgs.fishPlugins.puffer;
      }
      {
        name = "tide";
        src = pkgs.fishPlugins.tide;
      }
    ];

    interactiveShellInit = ''
      # Enable vi mode
      fish_vi_key_bindings

      # Vi mode status indicator
      function fish_mode_prompt
        switch $fish_bind_mode
          case default
            set_color --bold red
            echo '[N]'
          case insert
            set_color --bold green
            echo '[I]'
          case replace_one
            set_color --bold yellow
            echo '[R]'
          case replace
            set_color --bold yellow
            echo '[R]'
          case visual
            set_color --bold magenta
            echo '[V]'
        end
        set_color normal
      end

      # Set up tide prompt (minimal config - run tide configure after first login)
      set -gx tide_left_prompt_items pwd git
      set -gx tide_right_prompt_items status cmd_duration
      set -gx tide_prompt_pad_items false

      # FZF configuration
      set -gx FZF_DEFAULT_COMMAND 'fd --hidden --type f --exclude .git'
      set -gx FZF_CTRL_T_COMMAND $FZF_DEFAULT_COMMAND
      set -gx FZF_DEFAULT_OPTS '--height 40% --reverse --inline-info --bind ctrl-a:select-all'

      # Enable zoxide integration
      zoxide init fish | source

      # Functions
      # mkcd: mkdir and cd
      function mkcd
        if test (count $argv) -eq 0
          echo "Error: Please provide folder name"
          return 1
        end
        mkdir -p $argv[1]; and cd $argv[1]
      end

      # zo: fuzzy jump to zoxide directory
      function zo
        set -l dir (zoxide query -l | fzf --height 40% --reverse --preview 'eza -la --icons --group-directories-first {} 2>/dev/null || ls -la {}')
        if test -n "$dir"
          cd $dir
        end
      end

      # nf: find file and open in nvim
      function nf
        set -l file (fzf --height 40%)
        if test -n "$file"
          nvim $file
        end
      end

      # envf: fuzzy env var picker
      function envf
        set -l out (env | cut -d= -f1 | sort -u | fzf --height 60% --reverse --prompt="ENV> " --header="Enter: copy value | Ctrl-Y: copy name" --expect=ctrl-y --preview='printenv {} 2>/dev/null' --preview-window='right,60%,wrap')
        set -l expect (echo $out | head -n 1)
        set -l key (echo $out | tail -n 1)

        if test -z "$key"
          return 0
        end

        if test "$expect" = "ctrl-y"
          set -l value $key
        else
          set -l value (printenv $key 2>/dev/null || true)
        end

        if command -v wl-copy >/dev/null 2>&1
          echo $value | wl-copy
        else if command -v xclip >/dev/null 2>&1
          echo $value | xclip -selection clipboard
        else if command -v pbcopy >/dev/null 2>&1
          echo $value | pbcopy
        else
          echo "No clipboard tool found"
          return 1
        end
        echo "Copied: $key"
      end

      # codex-with: switch codex auth
      function codex-with
        set -l name $argv[1]
        set -l args $argv[2..-1]

        set -l src "$HOME/.codex/auth.$name.json"
        set -l default "$HOME/.codex/auth.default.json"
        set -l active "$HOME/.codex/auth.json"

        if test -z "$name"
          echo "Usage: codex-with <one|two> -- codex args"
          return 1
        end

        if test ! -f "$src"
          echo "Not found: $src"
          return 1
        end

        if test ! -f "$default"
          echo "Not found: $default"
          echo "Create: cp ~/.codex/auth.json ~/.codex/auth.default.json"
          return 1
        end

        cp "$src" "$active"
        echo "Switched Codex to: $name"
        codex $args
      end

      # prefer_nix: prefer nix store version of package
      function prefer_nix
        set -l pkg $argv[1]
        if test -z "$pkg"
          echo "Usage: prefer_nix <package>"
          return 1
        end

        set -l path (find /nix/store -maxdepth 1 -type d -name "*-$pkg-*" | head -n 1)

        if test -n "$path" -a -d "$path/bin"
          set -gx PATH "$path/bin" $PATH
        else
          echo "Package $pkg not found in /nix/store"
          return 1
        end
      end

      # cd with fzf fallback (no args -> fzf directory picker)
      function cdp
        if test (count $argv) -gt 0
          cd $argv
          return
        end

        set -l dir (fd --hidden --type d --exclude .git --exclude node_modules --exclude venv . . 2>/dev/null | fzf --height 40% --reverse --preview 'eza -la --icons --group-directories-first {} 2>/dev/null || ls -la {}')
        if test -n "$dir"
          cd $dir
        end
      end

      # Key bindings
      bind -M insert \co __fish_open_current_commandline
      bind -M normal \co __fish_open_current_commandline

      # Abbreviations (fish's smart aliases)
      # Navigation
      abbr -a .. 'cd ..'
      abbr -a ... 'cd ../..'
      abbr -a de 'cd ~/Desktop'
      abbr -a prj 'cd ~/Projects'

      # Editor
      abbr -a vim nvim
      abbr -a c 'clear'

      # System
      abbr -a hms 'home-manager switch --flake ~/.config/home-manager'
      abbr -a st 'systemctl-tui'
      abbr -a lock 'loginctl lock-session'

      # Clipboard
      abbr -a pwdc "pwd | string collect | wl-copy"
      abbr -a paste 'wl-paste'

      # Development
      abbr -a of 'onefetch --disabled-fields description head pending version dependencies authors last-change url churn license --no-art --no-title --no-color-palette'
    '';

    loginShellInit = ''
      # Run tide configuration wizard on first login
      if not set -q tide_configured
        tide configure --auto
        set -U tide_configured 1
      end
    '';
  };

  # Fish is an alternative shell - zsh remains default
}
