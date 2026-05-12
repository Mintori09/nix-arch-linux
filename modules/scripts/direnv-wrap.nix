{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };

  # Completion script for direnv-wrap
  dwCompletion = pkgs.writeTextFile {
    name = "dw-zsh-completion";
    destination = "/share/zsh/site-functions/_dw";
    text = ''
      #compdef dw direnv-wrap

      # Language descriptions with scaffold info for right-bar display
      _dw_lang_descriptions=(
        'python:Python with pipenv/pyenv style environment - scaffold: requirements.txt'
        'node:Node.js with npm/yarn/pnpm - scaffold: package.json'
        'go:Go with local GOPATH - no scaffold'
        'rust:Rust with local CARGO_HOME - no scaffold'
        'ruby:Ruby with bundler - scaffold: Gemfile'
        'java:Java with Maven/Gradle - no scaffold'
        'deno:Deno runtime - no scaffold'
        'qt:Qt5/Qt6 GUI app with xcb platform'
        'gtk:GTK3/GTK4 GUI app'
        'wails:Wails (Go+WebView) desktop app'
        'tauri:Tauri (Rust+WebView) desktop app'
        'flutter:Flutter desktop application'
        'electron:Electron desktop application'
      )

      _dw_languages() {
        _describe -t languages 'language' _dw_lang_descriptions
      }

      _dw() {
        local -a subcommands
        subcommands=(
          'init:Initialize direnv environment for a language'
          'list:List supported languages'
          'add:Add direnv config to existing project'
        )

        if (( CURRENT == 2 )); then
          _describe -t subcommands 'subcommand' subcommands
        elif (( CURRENT == 3 )); then
          case $words[2] in
            init|add)
              _dw_languages
              ;;
          esac
        fi
      }

      compdef _dw dw direnv-wrap
    '';
  };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "dw";
    runtime = "${pkgs.bun}/bin/bun";
    entry = "${../../scripts/execute}/direnv-wrap.ts";
  } ++ [ dwCompletion ];
}