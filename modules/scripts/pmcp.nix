{
  pkgs,
  config,
  ...
}:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
  sharedMcp = import ../programs/agents/mcp.nix { inherit pkgs config; };

  # Tự động trích xuất toàn bộ server names từ modules/programs/agents/mcp.nix
  mcpNames = builtins.attrNames sharedMcp;
  serverCompletions = builtins.concatStringsSep "\n          " (
    map (name: "'${name}:MCP Server (${name})'") mcpNames
  );

  pmcpCompletion = pkgs.writeTextFile {
    name = "pmcp-zsh-completion";
    destination = "/share/zsh/site-functions/_pmcp";
    text = ''
      #compdef pmcp

      _pmcp_presets() {
        local -a presets
        presets=(
          'web:Browser automation and scraping (obscura, camoufox)'
          'browser:Browser automation and scraping (obscura, camoufox)'
          'docs:Documentation and encyclopedia (context7, deepwiki)'
          'minimal:Minimal 0MB process RAM (context7, deepwiki)'
          'rust:Rust analysis and transpilation (rust-anything)'
          'study:AnkiConnect flashcard sync (anki)'
          'all:Enable all available MCP servers'
          'none:Remove all local project MCP configurations'
        )
        _describe -t presets 'preset' presets
      }

      _pmcp_servers() {
        local -a servers
        servers=(
          ${serverCompletions}
        )
        _describe -t servers 'mcp server' servers
      }

      _pmcp() {
        local -a commands
        commands=(
          'menu:Mở menu tương tác fzf chọn MCP servers'
          'add:Bật các MCP server trong project hiện tại'
          'rm:Gỡ MCP server khỏi project hiện tại'
          'remove:Gỡ MCP server khỏi project hiện tại'
          'use:Kích hoạt nhanh theo preset mẫu'
          'preset:Kích hoạt nhanh theo preset mẫu'
          'ls:Liệt kê các MCP server đang kích hoạt'
          'status:Liệt kê các MCP server đang kích hoạt'
          'clean:Xóa toàn bộ cấu hình MCP cục bộ'
          'reset:Xóa toàn bộ cấu hình MCP cục bộ'
        )

        local curcontext="$curcontext" state line
        typeset -A opt_args

        _arguments -C \
          '-a[Giới hạn agent]:agents:(all opencode claude antigravity)' \
          '--agent[Giới hạn agent]:agents:(all opencode claude antigravity)' \
          '-y[Áp dụng ngay không hỏi lại]' \
          '--yes[Áp dụng ngay không hỏi lại]' \
          '--dry-run[Xem trước JSON không ghi đĩa]' \
          '-h[Hiển thị trợ giúp]' \
          '--help[Hiển thị trợ giúp]' \
          '1: :->command' \
          '*: :->args'

        case $state in
          command)
            _describe -t commands 'pmcp command' commands
            _pmcp_servers
            ;;
          args)
            case $words[1] in
              use|preset)
                _pmcp_presets
                ;;
              add|rm|remove)
                _pmcp_servers
                ;;
              *)
                _pmcp_servers
                ;;
            esac
            ;;
        esac
      }

      compdef _pmcp pmcp
    '';
  };
in
{
  home.packages =
    (helpers.mkScriptPackage {
      name = "pmcp";
      entry = "${../../scripts/execute}/pmcp.ts";
      extraPathPackages = [
        pkgs.fzf
        pkgs.jq
      ];
    })
    ++ [ pmcpCompletion ];
}
