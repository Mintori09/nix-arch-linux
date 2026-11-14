# Nushell completions for Antigravity CLI (`agy`)

def "nu-complete agy-enum-from-help" [help: string, flag: string] {
  let line = (
    $help
    | lines
    | where { |s| $s | str contains $"--$flag" }
    | get 0
    | default ""
  )
  if ($line | is-empty) { return [] }
  # Extract content inside the first parenthesized group, e.g. (low|medium|high)
  let inner = ($line | str replace -r '.*\(([^)]+)\).*' '$1')
  # Split on | or , into individual values
  let vals = (
    $inner
    | str replace -a -r '[|,]' "\n"
    | lines
    | str trim
    | where { |s| ($s | str length) > 0 }
  )
  ($vals | each {|v| { value: $v, description: $v } })
}

def "nu-complete agy models" [] {
  let parsed = (try {
    ^agy models
    | lines
    | where { |s| ($s | str trim) | is-not-empty }
    | each {|line|
      let trimmed = ($line | str trim)
      let is_skip = (($trimmed | str contains "Fetching") or ($trimmed | str contains "available models"))
      let parts = ($trimmed | str replace -a "\t" "\n" | lines)
      let val = ($parts | get 0 | default "")
      let desc = ($parts | get 1 | default $val)
      if $is_skip { null } else { { value: $val, description: $desc } }
    }
    | where { |s| $s != null }
  } catch { [] })
  if ($parsed | is-not-empty) {
    $parsed
  } else {
    [
      { value: "gemini-3.8-flash-high", description: "Gemini 3.8 Flash (High)" }
      { value: "gemini-3.8-flash-medium", description: "Gemini 3.8 Flash (Medium)" }
      { value: "gemini-3.8-flash-low", description: "Gemini 3.8 Flash (Low)" }
    ]
  }
}

def "nu-complete agy effort" [] {
  [
    { value: "low", description: "Low reasoning effort" }
    { value: "medium", description: "Medium reasoning effort" }
    { value: "high", description: "High reasoning effort" }
    { value: "xhigh", description: "Extra high reasoning effort" }
    { value: "max", description: "Maximum reasoning effort" }
  ]
}

def "nu-complete agy mode" [] {
  [
    { value: "accept-edits", description: "Accept edits mode" }
    { value: "auto", description: "Autonomous execution" }
    { value: "plan", description: "Planning mode" }
  ]
}

def "nu-complete agy input-format" [] {
  [ "text", "stream-json" ]
}

def "nu-complete agy output-format" [] {
  [ "text", "json", "stream-json" ]
}

def "nu-complete agy mcp-types" [] {
  [ "stdio", "http" ]
}

def "nu-complete agy conversations" [] {
  let db = $"($env.HOME)/.gemini/antigravity-cli/conversation_summaries.db"
  if ($db | path exists) and (which sqlite3 | is-not-empty) {
    let parsed = (try {
      ^sqlite3 -init /dev/null -csv $db "SELECT conversation_id, replace(title, ':', ' - ') FROM conversation_summaries ORDER BY last_modified_time DESC LIMIT 30;"
      | from csv --noheaders
      | rename id title
      | each {|row|
        { value: $row.id, description: ($row.title | default "conversation") }
      }
    } catch { [] })
    if ($parsed | is-not-empty) {
      return $parsed
    }
  }
  []
}

def "nu-complete agy mcp-servers" [] {
  let cfg = $"($env.HOME)/.gemini/antigravity-cli/mcp_config.json"
  if ($cfg | path exists) {
    try {
      let data = (open $cfg)
      if ($data | get -o mcpServers | is-not-empty) {
        return ($data.mcpServers | columns | each {|s| { value: $s, description: "MCP server" } })
      }
    }
  }
  []
}

def "nu-complete agy plugins" [] {
  let parsed = (try {
    ^agy plugin list
    | lines
    | where { |s| $s | is-not-empty }
    | where { |s| not ($s | str contains "No imported plugins") }
    | each {|p| { value: ($p | str trim), description: "Plugin" } }
  } catch { [] })
  if ($parsed | is-not-empty) {
    $parsed
  } else {
    []
  }
}

# Antigravity CLI - Google DeepMind AI Coding Assistant
export extern "agy" [
  --add-dir: path                                             # Add a directory to the workspace (repeatable)
  --agent: string                                             # Agent for the current CLI session
  --continue(-c)                                              # Continue the most recent conversation
  --conversation: string@"nu-complete agy conversations"       # Resume a previous conversation by ID
  --dangerously-skip-permissions                              # Auto-approve all tool permission requests
  --disable-slash-commands                                    # Disable slash command and skill expansion in print mode
  --effort: string@"nu-complete agy effort"                   # Reasoning effort for current session
  --prompt-interactive(-i)                                    # Run an initial prompt interactively and continue
  --input-format: string@"nu-complete agy input-format"        # Input format for print mode
  --json-schema: path                                         # JSON schema file or string for structured output
  --log-file: path                                            # Override CLI log file path
  --mode: string@"nu-complete agy mode"                       # Set agent execution mode
  --model: string@"nu-complete agy models"                    # Model for the current CLI session
  --new-project                                               # Create a new project for this session
  --output-format: string@"nu-complete agy output-format"      # Output format for print mode
  --print(-p)                                                 # Run single prompt non-interactively and print response
  --prompt: string                                            # Alias for --print
  --print-timeout: string                                     # Timeout for print mode wait (e.g. 5m)
  --project: string                                           # Project ID or project name
  --remote-control                                            # Create a remote connection on startup
  --sandbox                                                   # Run in a sandbox with terminal restrictions
  --help(-h)                                                  # Show help
]

# List available agents
export extern "agy agent" [ --help(-h) ]
export extern "agy agents" [ --help(-h) ]

# Show changelog and release notes
export extern "agy changelog" [ --help(-h) ]

# Configure environment paths and shell settings
export extern "agy install" [
  --dir: path           # Custom directory target to configure PATH for
  --skip-aliases        # Bypass shell profile alias purging
  --skip-path           # Bypass shell profile PATH appending
  --help(-h)            # Show help
]

# Manage MCP servers
export extern "agy mcp" [ --help(-h) ]

# Add or update an MCP server configuration
export extern "agy mcp add" [
  server_name: string                                 # Name of MCP server
  cmd_or_url: string                                  # Command binary or HTTP URL
  ...args: string                                     # Arguments to command
  --header(-H): string                                # HTTP header (Key: Value)
  --env(-e): string                                   # Environment variable (KEY=value)
  --type(-t): string@"nu-complete agy mcp-types"       # Server type (stdio or http)
  --help(-h)                                          # Show help
]

# Remove an MCP server configuration
export extern "agy mcp remove" [
  server: string@"nu-complete agy mcp-servers"         # Server to remove
  --help(-h)                                          # Show help
]

# List all configured MCP servers
export extern "agy mcp list" [ --help(-h) ]

# Enable an MCP server
export extern "agy mcp enable" [
  server: string@"nu-complete agy mcp-servers"         # Server to enable
  --help(-h)                                          # Show help
]

# Disable an MCP server
export extern "agy mcp disable" [
  server: string@"nu-complete agy mcp-servers"         # Server to disable
  --help(-h)                                          # Show help
]

# Serve this machine's microphone to a CLI on another host
export extern "agy mic-serve" [
  --addr: string        # Address to listen on (default: 127.0.0.1:4713)
  --help(-h)            # Show help
]

# List available models
export extern "agy models" [ --help(-h) ]

# Manage plugins
export extern "agy plugin" [ --help(-h) ]
export extern "agy plugins" [ --help(-h) ]

# List imported plugins
export extern "agy plugin list" [ --help(-h) ]

# Install a plugin
export extern "agy plugin install" [
  path: path            # Target plugin directory
  --help(-h)            # Show help
]

# Uninstall a plugin
export extern "agy plugin uninstall" [
  plugin: string@"nu-complete agy plugins"            # Plugin name
  --help(-h)                                          # Show help
]

# Enable a plugin
export extern "agy plugin enable" [
  plugin: string@"nu-complete agy plugins"            # Plugin name
  --help(-h)                                          # Show help
]

# Disable a plugin
export extern "agy plugin disable" [
  plugin: string@"nu-complete agy plugins"            # Plugin name
  --help(-h)                                          # Show help
]

# Manage the remote-control background daemon
export extern "agy remote-control" [ --help(-h) ]

# Register and start the remote-control daemon
export extern "agy remote-control start" [
  --name: string        # Instance name shown in Remote Control
  --session             # Register login-scoped daemon instead of starting at boot
  --help(-h)            # Show help
]

# Show the remote-control daemon status
export extern "agy remote-control status" [ --help(-h) ]

# Stop the daemon and unregister it
export extern "agy remote-control stop" [ --help(-h) ]

# Update CLI
export extern "agy update" [ --help(-h) ]
