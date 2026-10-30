# Nushell Environment Configuration
$env.CARAPACE_BRIDGES = 'zsh,fish,bash'
$env.EDITOR = 'nvim'
$env.VISUAL = 'nvim'
$env.PAGER = 'bat'

# Directories to search for scripts and modules
$env.NU_LIB_DIRS = [
    ($nu.default-config-dir | path join 'scripts')
    ($nu.default-config-dir)
    ($env.HOME | path join '.config' 'nushell')
]


