{
  pkgs,
  config,
  ...
}:
{
  context7 = {
    local = {
      argv = [
        "${pkgs.nodejs}/bin/npx"
        "-y"
        "@upstash/context7-mcp"
      ];
    };
    remote = {
      url = "https://mcp.context7.com/mcp";
      timeout = 10000;
    };
    enabled = true;
  };

  playwright = {
    local = {
      argv = [
        "${pkgs.nodejs}/bin/npx"
        "@playwright/mcp@latest"
      ];
    };
    enabled = true;
  };

  github = {
    local = {
      argv = [
        "${pkgs.nodejs}/bin/npx"
        "-y"
        "@modelcontextprotocol/server-github"
      ];
      env = {
        GITHUB_PERSONAL_ACCESS_TOKEN = "$(${pkgs.gh}/bin/gh auth token)";
      };
    };
    enabled = true;
  };

  deepwiki = {
    remote = {
      url = "https://mcp.deepwiki.com/mcp";
      timeout = 10000;
    };
    enabled = true;
  };

  tavily = {
    local = {
      argv = [
        "npx"
        "mcp-remote"
        "https://mcp.tavily.com/mcp"
      ];
    };
    enabled = false;
  };

  figwright = {
    local = {
      argv = [
        "${pkgs.nodejs}/bin/npx"
        "-y"
        "@figwright/mcp@latest"
      ];
    };
    enabled = true;
  };

  firefox-devtools = {
    local = {
      argv = [
        "${pkgs.nodejs}/bin/npx"
        "-y"
        "@mozilla/firefox-devtools-mcp@latest"
        "--headless"
        "--viewport"
        "1280x720"
      ];
      env = {
        START_URL = "about:blank";
      };
    };
    enabled = true;
  };

}
