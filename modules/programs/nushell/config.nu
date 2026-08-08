# Nushell Main Configuration
$env.config = {
  show_banner: false
  edit_mode: "vi"
  use_kitty_protocol: true
  shell_integration: {
    osc2: true
    osc7: true
    osc133: true
    reset_application_mode: true
  }
  table: {
    mode: rounded
    index_mode: always
    show_empty: true
    padding: { left: 1, right: 1 }
  }
  history: {
    file_format: "sqlite"
    sync_on_enter: true
    isolation: false
  }
  rm: {
    always_trash: false
  }
}

# Direnv env_change hook
$env.config = ($env.config | merge {
  hooks: {
    env_change: {
      PWD: [
        {||
          if (which direnv | is-not-empty) {
            direnv export json | from json | default {} | load-env
            if ($env.PATH | describe | str contains "string") {
              $env.PATH = ($env.PATH | split row (char esep))
            }
          }
        }
      ]
    }
  }
})

# Carapace & Fallback completion setup
let external_completer = {|spans|
  let expanded_alias = (scope aliases | where name == $spans.0 | get -o 0.expansion)
  let spans = (if $expanded_alias != null {
    $spans | skip 1 | prepend ($expanded_alias | split row ' ')
  } else {
    $spans })

  carapace $spans.0 nushell ...$spans | from json
}

$env.config = ($env.config | merge {
  completions: {
    case_sensitive: false
    quick: true
    partial: true
    algorithm: "fuzzy"
    external: {
      enable: true
      max_results: 100
      completer: $external_completer
    }
  }
})

# Custom completions from nu_scripts (item 2)
use nu_scripts/custom-completions/git/git-completions.nu *
use nu_scripts/custom-completions/cargo/cargo-completions.nu *
use nu_scripts/custom-completions/nix/nix-completions.nu *
use nu_scripts/custom-completions/bat/bat-completions.nu *

# Quick Utility Aliases
alias ll = eza -l --icons --git
alias la = eza -la --icons --git
alias lt = eza --tree --level=2 --icons
alias cat = bat
alias g = git
alias hms = home-manager switch --flake ~/.config/home-manager

# Dynamic fzf workspace directory search
def --env cdp [] {
  let target = (
    fd --hidden --type d --max-depth 3 . ~/projects ~/dotfiles
    | fzf --height=40% --reverse --preview 'eza -la --icons --group-directories-first {}'
    | str trim
  )
  if not ($target | is-empty) {
    cd $target
  }
}

# Interactive directory navigation with FZF + eza preview
def --env cdi [path?: string] {
  if ($path | is-empty) {
    let target = (
      fd --hidden --type d --exclude .git --exclude node_modules --exclude .venv . .
      | fzf --height=40% --reverse --preview 'eza -la --icons --group-directories-first {}'
      | str trim
    )
    if not ($target | is-empty) {
      cd $target
    }
  } else {
    cd $path
  }
}

# Keybindings configuration
$env.config = ($env.config | merge {
  keybindings: [
    {
      name: zoxide_menu
      modifier: alt
      keycode: char_z
      mode: [emacs, vi_normal, vi_insert]
      event: {
        send: executehostcommand
        cmd: "let dir = (zoxide query --interactive | str trim); if not ($dir | is-empty) { cd $dir }"
      }
    }
    {
      name: fzf_find_file
      modifier: control
      keycode: char_o
      mode: [emacs, vi_normal, vi_insert]
      event: {
        send: executehostcommand
        cmd: "let file = (rg -l '.*' --hidden --glob '!.git' --glob '!.venv' --glob '!node_modules' --glob '!target' | fzf --height=80% --reverse --preview 'bat --color=always --line-range :50 {}' | str trim); if not ($file | is-empty) { nvim $file }"
      }
    }
    {
      name: fzf_history
      modifier: control
      keycode: char_r
      mode: [emacs, vi_normal, vi_insert]
      event: {
        send: executehostcommand
        cmd: "let cmd = (history | get command | reverse | uniq | str join (char newline) | fzf --height=40% --reverse --no-preview | str trim); if not ($cmd | is-empty) { commandline edit --insert $cmd }"
      }
    }
  ]
})
