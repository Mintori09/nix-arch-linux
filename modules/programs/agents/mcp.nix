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
    enabled = false;
  };

  playwright-headless = {
    local = {
      argv = [
        "${pkgs.nodejs}/bin/npx"
        "@playwright/mcp@latest"
        "--headless"
      ];
    };
    enabled = false;
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
    enabled = false;
  };

  deepwiki = {
    remote = {
      url = "https://mcp.deepwiki.com/mcp";
      timeout = 10000;
    };
    enabled = true;
  };

  apify = {
    remote = {
      url = "https://mcp.apify.com/";
      headers = {
        Authorization = "Bearer $APIFY_API_KEY";
      };
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
    enabled = false;
  };

  firefox-devtools = {
    local = {
      argv = [
        "${pkgs.nodejs}/bin/npx"
        "-y"
        "@mozilla/firefox-devtools-mcp@latest"
        "--viewport"
        "1280x720"
      ];
      env = {
        START_URL = "about:blank";
      };
    };
    enabled = false;
  };

  firefox-devtools-headless = {
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
    enabled = false;
  };

  colab-mcp = {
    local = {
      argv = [
        "${pkgs.uv}/bin/uvx"
        "git+https://github.com/googlecolab/colab-mcp"
      ];
    };
    enabled = true;
  };

  notebooklm = {
    local = {
      argv = [
        "${pkgs.uv}/bin/uvx"
        "--from"
        "notebooklm-mcp-cli"
        "notebooklm-mcp"
      ];
    };
    enabled = false;
  };

  cloudflare = {
    remote = {
      url = "https://mcp.cloudflare.com/mcp";
      headers = {
        Authorization = "Bearer $CLOUDFLARE_API_TOKEN";
      };
      timeout = 10000;
    };
    local = {
      argv = [
        "${pkgs.nodejs}/bin/npx"
        "-y"
        "mcp-remote"
        "https://mcp.cloudflare.com/mcp"
      ];
      env = {
        CLOUDFLARE_API_TOKEN = "$CLOUDFLARE_API_TOKEN";
      };
    };
    enabled = false;
  };
}
