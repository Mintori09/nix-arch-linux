# Nushell completions for OpenCode (`opencode`)

def "nu-complete opencode models" [] {
  let cache_dir = ($env.XDG_CACHE_HOME? | default $"($env.HOME)/.cache/opencode")
  let cache_file = $"($cache_dir)/models.cache"
  if ($cache_file | path exists) {
    let lines = (open $cache_file | lines | where ($it | str trim | is-not-empty))
    if ($lines | is-not-empty) {
      return ($lines | each {|m| { value: ($m | str trim), description: "Model" } })
    }
  }

  [
    { value: "opencode-go/deepseek-v4-flash", description: "DeepSeek V4 Flash" }
    { value: "opencode-go/deepseek-v4-pro", description: "DeepSeek V4 Pro" }
    { value: "opencode-go/glm-5.1", description: "GLM 5.1" }
    { value: "opencode/claude-sonnet-4-6", description: "Claude Sonnet 4.6" }
    { value: "opencode/gemini-3.8-flash", description: "Gemini 3.8 Flash" }
  ]
}

def "nu-complete opencode sessions" [] {
  let data_dir = ($env.XDG_DATA_HOME? | default $"($env.HOME)/.local/share")
  let db = $"($data_dir)/opencode/opencode.db"
  if ($db | path exists) and (which sqlite3 | is-not-empty) {
    let output = (
      ^sqlite3 -init /dev/null -csv $db "SELECT id, replace(replace(title, char(10), ' '), ':', ' - ') FROM session WHERE title IS NOT NULL AND length(title) > 0 ORDER BY time_updated DESC LIMIT 30;"
      | complete
    )
    if $output.exit_code == 0 and ($output.stdout | is-not-empty) {
      return ($output.stdout | from csv --noheaders | rename id title | each {|row|
        { value: $row.id, description: ($row.title | default "session") }
      })
    }
  }
  []
}

def "nu-complete opencode log-levels" [] {
  [ "DEBUG", "INFO", "WARN", "ERROR" ]
}

def "nu-complete opencode providers" [] {
  [ "opencode-go", "anthropic", "openai", "google", "ollama", "github-copilot" ]
}

def "nu-complete opencode shells" [] {
  [ "bash", "zsh", "fish", "powershell" ]
}

# AI Coding Assistant
export extern "opencode" [
  project?: path                                                # Path to start opencode in
  --help(-h)                                                    # Show help
  --version(-v)                                                 # Show version number
  --model(-m): string@"nu-complete opencode models"             # Model to use (provider/model)
  --session(-s): string@"nu-complete opencode sessions"         # Session ID to continue
  --continue(-c)                                                # Continue the last session
  --fork                                                        # Fork session when continuing
  --prompt: string                                              # Prompt to use
  --agent: string                                               # Agent to use
  --auto                                                        # Auto-approve non-denied permissions
  --pure                                                        # Run without external plugins
  --port: int                                                   # Port to listen on
  --hostname: string                                            # Hostname to listen on
  --log-level: string@"nu-complete opencode log-levels"         # Log level
  --print-logs                                                  # Print logs to stderr
  --mini                                                        # Start minimal interactive interface
  --no-replay                                                   # Disable mini session history replay
  --replay-limit: int                                           # Cap visible mini replay
]

# Generate shell completion script
export extern "opencode completion" [
  shell?: string@"nu-complete opencode shells"                  # Target shell
  --help(-h)                                                    # Show help
]

# Start ACP (Agent Client Protocol) server
export extern "opencode acp" [ --help(-h) ]

# Manage MCP servers
export extern "opencode mcp" [ --help(-h) ]

# Attach to a running opencode server
export extern "opencode attach" [
  url: string                                                   # OpenCode server URL
  --help(-h)                                                    # Show help
]

# Run opencode with a prompt message
export extern "opencode run" [
  ...message: string                                            # Prompt message
  --model(-m): string@"nu-complete opencode models"             # Model to use
  --session(-s): string@"nu-complete opencode sessions"         # Session to run in
  --continue(-c)                                                # Continue last session
  --agent: string                                               # Agent to use
  --help(-h)                                                    # Show help
]

# Debugging and troubleshooting tools
export extern "opencode debug" [ --help(-h) ]

# Manage AI providers and credentials
export extern "opencode providers" [ --help(-h) ]
export extern "opencode auth" [ --help(-h) ]

# Manage agents
export extern "opencode agent" [ --help(-h) ]

# Upgrade opencode to latest or specific version
export extern "opencode upgrade" [
  target?: string                                               # Version target
  --help(-h)                                                    # Show help
]

# Uninstall opencode and remove all related files
export extern "opencode uninstall" [ --help(-h) ]

# Starts a headless opencode server
export extern "opencode serve" [
  --port: int                                                   # Server port
  --hostname: string                                            # Server host
  --help(-h)                                                    # Show help
]

# Start opencode server and open web interface
export extern "opencode web" [
  --port: int                                                   # Web UI port
  --hostname: string                                            # Web UI host
  --help(-h)                                                    # Show help
]

# List all available models
export extern "opencode models" [
  provider?: string@"nu-complete opencode providers"           # Filter by provider
  --help(-h)                                                    # Show help
]

# Show token usage and cost statistics
export extern "opencode stats" [ --help(-h) ]

# Export session data as JSON
export extern "opencode export" [
  session?: string@"nu-complete opencode sessions"              # Session ID to export
  --help(-h)                                                    # Show help
]

# Import session data from JSON file
export extern "opencode import" [
  file: path                                                    # JSON file path
  --help(-h)                                                    # Show help
]

# Manage GitHub agent
export extern "opencode github" [ --help(-h) ]

# Fetch and checkout a GitHub PR branch, then run opencode
export extern "opencode pr" [
  number: int                                                   # PR number
  --help(-h)                                                    # Show help
]

# Manage sessions
export extern "opencode session" [ --help(-h) ]

# Install plugin and update config
export extern "opencode plugin" [
  module: string                                                # Plugin module name
  --help(-h)                                                    # Show help
]
export extern "opencode plug" [
  module: string                                                # Plugin module name
  --help(-h)                                                    # Show help
]

# Database tools
export extern "opencode db" [ --help(-h) ]
