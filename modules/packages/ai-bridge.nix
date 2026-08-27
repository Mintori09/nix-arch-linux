{ pkgs, ... }:

let
  runtimeDeps = with pkgs; [
    nodejs
    wl-clipboard
    xdg-utils
    kdotool
  ];

  zshCompletion = ''
    #compdef ai-bridge
    _ai_bridge() {
        local context state line
        typeset -A opt_args
        _arguments -C \
            '1: :->command' \
            '*:: :->args'
        case $state in
            command)
                local -a subcommands
                subcommands=(
                    'clipboard:Interact with the system clipboard'
                    'queue:View the current job queue'
                    'clear:Clear all entries from the queue'
                    'status:Check the status of a specific job ID'
                    'stats:View system usage statistics'
                    'health:Check daemon health status'
                    'focus:Focus on the current task'
                    'server:Start the background daemon'
                    'stop:Stop the running daemon'
                )
                _describe -t subcommands 'ai-bridge commands' subcommands
                                  
                _arguments \
                    '-t[Specify a title]:title:_files' \
                    '--ttl[Specify time-to-live in seconds]:ttl:'
                ;;
            args)
                case $line[1] in
                    clipboard)
                        _arguments \
                            '--paste-only[Only paste the current content without reading configuration]' \
                            '-t[Specify a title]:title:_files' \
                            '--ttl[Specify time-to-live in seconds]:ttl:'
                        ;;
                    status)
                        _arguments \
                            '1: :_message "job ID"'
                        ;;
                    *)
                        _arguments \
                            '-t[Specify a title]:title:_files' \
                            '--ttl[Specify time-to-live in seconds]:ttl:'
                        ;;
                esac
                ;;
        esac
    }
    _ai_bridge "$@"
  '';
in
pkgs.stdenv.mkDerivation {
  pname = "ai-bridge";
  version = "1.0.0";

  src = ../../packages/ai-bridge;

  nativeBuildInputs = [
    pkgs.makeWrapper
    pkgs.esbuild
    pkgs.nodejs
  ];

  buildPhase = ''
    mkdir -p dist
    esbuild src/cli/index.ts --bundle --platform=node --format=esm --outfile=dist/ai-bridge.js
    if [ -f userscript/build.mjs ]; then
      node userscript/build.mjs
    fi
  '';

  installPhase = ''
    mkdir -p $out/bin $out/share/ai-bridge $out/share/zsh/site-functions
    cp dist/ai-bridge.js $out/share/ai-bridge/ai-bridge.js
    makeWrapper ${pkgs.nodejs}/bin/node $out/bin/ai-bridge \
      --add-flags "$out/share/ai-bridge/ai-bridge.js" \
      --prefix PATH : ${pkgs.lib.makeBinPath runtimeDeps}

    if [ -f dist/ai-bridge.user.js ]; then
      cp dist/ai-bridge.user.js $out/share/ai-bridge/ai-bridge.user.js
    fi

    cat <<'EOF' > $out/share/zsh/site-functions/_ai-bridge
    ${zshCompletion}
    EOF
  '';

  meta = with pkgs.lib; {
    description = "AI Bridge - Bridge terminal prompts to AI web apps";
    mainProgram = "ai-bridge";
    license = licenses.isc;
    platforms = platforms.linux;
  };
}
