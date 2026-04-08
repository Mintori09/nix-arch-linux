{ lib, ... }:
let
  secretsFile = ~/Desktop/secrets.json;

  secrets =
    if builtins.pathExists secretsFile then builtins.fromJSON (builtins.readFile secretsFile) else { };
in
{
  home.sessionVariables = {
    KILO_API_KEY = secrets.KILO_API_KEY or "";
    GEMINI_API_KEY = secrets.GEMINI_API_KEY or "";
    OPENROUTER_API_KEY = secrets.OPENROUTER_API_KEY or "";
    GROQ_API_KEY = secrets.GROQ_API_KEY or "";
    NANOGPT_API_KEY = secrets.NANOGPT_API_KEY or "";
  };
}
