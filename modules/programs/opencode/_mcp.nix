{
  gh_grep = {
    type = "remote";
    url = "https://mcp.grep.app/";
    enabled = true;
    timeout = 10000;
  };
  deepwiki = {
    type = "remote";
    url = "https://mcp.deepwiki.com/mcp";
    enabled = true;
    timeout = 10000;
  };
  context7 = {
    type = "remote";
    url = "https://mcp.context7.com/mcp";
    enabled = true;
    timeout = 10000;
  };
  playwright = {
    type = "local";
    command = [
      "npx"
      "@playwright/mcp@latest"
    ];
    enabled = true;
  };
}
