settings.blocklistPattern =
  /.*(colab\.google\.com|mail\.google\.com|docs\.google\.com|twitter\.com|notion\.so).*/i;
settings.digitForRepeat = false;
api.unmap("yd");
api.unmap("yo");
api.unmap("yg");
api.iunmap("<Ctrl-a>");
api.unmap("<ctrl-h>");
api.unmap("<Ctrl-h>");
api.unmap("p");
api.unmap("P");
api.unmap("oc");
api.unmap("x");
api.unmap("oo");
api.unmap("gm");
api.unmap("gld");
api.unmap("yu");
api.unmap("gh");

api.mapkey("yu", "Open in new tab with parent url", function () {
  var url = new URL(window.location.href);
  var newUrl;

  if (url.hash) {
    newUrl = url.origin + url.pathname + url.search;
  } else if (url.search) {
    newUrl = url.origin + url.pathname;
  } else if (url.pathname !== "/") {
    var pathParts = url.pathname.replace(/\/$/, "").split("/");
    pathParts.pop();
    newUrl = url.origin + (pathParts.join("/") || "/");
  } else {
    newUrl = url.href;
  }

  api.RUNTIME("openLink", {
    tab: {
      tabbed: true,
      active: true,
    },
    url: newUrl,
  });
});

api.mapkey("gm", "Mở hoặc chuyển sang tab Messenger", function () {
  api.RUNTIME("getTabs", null, function (response) {
    var messengerTab = response.tabs.find(function (tab) {
      return (
        tab.url &&
        (tab.url.includes("messenger.com") ||
          tab.url.includes("facebook.com/messages"))
      );
    });

    if (messengerTab) {
      api.RUNTIME("focusTab", {
        windowId: messengerTab.windowId,
        tabId: messengerTab.id,
      });
    } else {
      api.tabOpenLink("https://www.messenger.com");
    }
  });
});

api.mapkey("gld", "Open tab or move to linkding", function () {
  api.RUNTIME("getTabs", null, function (response) {
    var linkdingTab = response.tabs.find(function (tab) {
      return (
        tab.url &&
        (tab.url.includes("linkding.mintori.dev") ||
          tab.url.includes("localhost:9090"))
      );
    });

    if (linkdingTab) {
      api.RUNTIME("focusTab", {
        windowId: linkdingTab.windowId,
        tabId: linkdingTab.id,
      });
    } else {
      api.tabOpenLink("http://localhost:9090");
    }
  });
});

api.mapkey("of", "Open current url link with defuddle", () => {
  const currentUrl = window.location.href;
  const defuddleUrl = "https://defuddle.md/";
  const url = `${defuddleUrl}${currentUrl}`;
  if (url) {
    window.location.href = url;
  }
});

api.addSearchAlias(
  "r",
  "reddit-google",
  "https://www.google.com/search?q=site:reddit.com%20",
);

api.addSearchAlias(
  "h",
  "github-google",
  "https://www.google.com/search?q=site:github.com%20",
);

api.addSearchAlias(
  "v",
  "voz-google",
  "https://www.google.com/search?q=site:voz.vn%20",
);

function isGoogleSearchSite() {
  return /(^|\.)google\.[a-z.]+$/i.test(window.location.hostname);
}

function addSite(site) {
  const url = new URL(window.location.href);
  const q = url.searchParams.get("q") || "";
  if (!/site:github\.com/i.test(q)) {
    url.searchParams.set("q", (q ? q + " " : "") + `site:${site}`);
    window.location.href = url.href;
    return;
  }
}

api.mapkey("ov", "Tìm kiếm Google Voz", function () {
  if (isGoogleSearchSite()) {
    addSite("voz.vn");
    return;
  }

  api.Front.openOmnibar({
    type: "SearchEngine",
    extra: "v",
  });
});

api.mapkey("gh", "Tìm kiếm Google Github", function () {
  if (isGoogleSearchSite()) {
    addSite("github.com");
    return;
  }

  api.Front.openOmnibar({
    type: "SearchEngine",
    extra: "h",
  });
});

api.mapkey("or", "Tìm kiếm Google Reddit", function () {
  if (isGoogleSearchSite()) {
    addSite("reddit.com");
    return;
  }

  api.Front.openOmnibar({
    type: "SearchEngine",
    extra: "r",
  });
});

api.mapkey("oo", "Open chatgpt in new tab", function () {
  window.open("https://gemini.google.com/app", "_blank")?.focus();
});

api.mapkey("x", "close current window", () => {
  window.close();
});

api.mapkey("oc", "Open chatgpt in new tab", function () {
  window.open("https://chatgpt.com/", "_blank")?.focus();
});

// an example to create a new mapping `ctrl-y`
// api.mapkey("<ctrl-y>", "Show me the money", function () {
//   api.Front.showPopup(
//     "a well-known phrase uttered by characters in the 1996 film Jerry Maguire (Escape to close).",
//   );
// });

api.mapkey("ge", "Edit current URL with vim editor, and reload", function () {
  api.Normal.feedkeys(";U");
});

api.mapkey("yf", "Copy link URL", function () {
  api.Normal.feedkeys("ya");
});

api.mapkey("yg", "Copy parent URL without navigating", function () {
  const href = window.location.href;
  const parent = href.replace(/\/[^/?#]*(?=[?#]|$)/, "");

  api.Clipboard.write(parent);
});

// Paste and open clipboard URL/text in current tab
api.mapkey("p", "Paste clipboard URL in current tab", function () {
  api.Clipboard.read(function (response) {
    const text = response.data.trim();
    if (!text) return;

    // Check if text is a valid URL or starts with http/https
    if (/^(https?:\/\/|file:\/\/)/i.test(text)) {
      window.location.href = text;
    } else if (
      /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(text) &&
      !text.includes(" ")
    ) {
      window.location.href = "https://" + text;
    } else {
      // Fallback to Google search if clipboard contains plain text
      window.location.href =
        "https://www.google.com/search?q=" + encodeURIComponent(text);
    }
  });
});

// Paste and open clipboard URL/text in new tab
api.mapkey("P", "Paste clipboard URL in new tab", function () {
  api.Clipboard.read(function (response) {
    const text = response.data.trim();
    if (text) {
      api.tabOpenLink(text);
    }
  });
});

api.mapkey("F", "Copy link URL", function () {
  api.Normal.feedkeys("af");
});

function toMpvUrl(url, type = "play") {
  if (/^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(url)) {
    const u = new URL(url);
    u.searchParams.delete("list");
    u.searchParams.delete("index");
    url = u.toString();
  }

  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let encoded = "";

  for (let i = 0; i < url.length; i += 3) {
    const a = url.charCodeAt(i);
    const b = i + 1 < url.length ? url.charCodeAt(i + 1) : 0;
    const c = i + 2 < url.length ? url.charCodeAt(i + 2) : 0;

    encoded += chars[a >> 2];
    encoded += chars[((a & 3) << 4) | (b >> 4)];
    encoded += i + 1 < url.length ? chars[((b & 15) << 2) | (c >> 6)] : "=";
    encoded += i + 2 < url.length ? chars[c & 63] : "=";
  }

  encoded = encoded.replace(/\//g, "_").replace(/\+/g, "-").replace(/=/g, "");

  return `mpv://${type}/${encoded}/?referer=${encoded}`;
}

api.unmap("yp");

const stopVideo = () => {
  const video = document.querySelector("video");

  if (video) {
    video.pause();
    // video.currentTime = 0; // Resets time to 0:00 (stop)
  }
};

api.mapkey("yp", "Download current video page", function () {
  const currentUrl = window.location.href;
  const url = toMpvUrl(currentUrl, "ytdl");
  window.location.href = url;
  stopVideo();
});

api.mapkey("ym", "Open current URL in mpv", function () {
  const currentUrl = window.location.href;
  const url = toMpvUrl(currentUrl);
  window.location.href = url;
  stopVideo();
});

api.mapkey("yd", "Download video by yt-dlp", function () {
  api.Hints.create("*[href]", function (element) {
    const currentUrl = element.href;
    const url = toMpvUrl(currentUrl, "ytdl");
    window.location.href = url;
  });
});

api.mapkey("yo", "Select and open video in mpv", function () {
  api.Hints.create("*[href]", function (element) {
    const currentUrl = element.href;
    const url = toMpvUrl(currentUrl);
    window.location.href = url;
    console.log(url);
  });
});

// an example to replace `T` with `gt`, click `Default mappings` to see how `T` works.
api.map("gt", "T");

// an example to remove mapkey `Ctrl-i`

// set theme
settings.theme = `
.sk_theme {
    font-family: Input Sans Condensed, Charcoal, sans-serif;
    font-size: 10pt;
    background: #24272e;
    color: #abb2bf;
}
.sk_theme tbody {
    color: #fff;
}
.sk_theme input {
    color: #d0d0d0;
}
.sk_theme .url {
    color: #61afef;
}
.sk_theme .annotation {
    color: #56b6c2;
}
.sk_theme .omnibar_highlight {
    color: #528bff;
}
.sk_theme .omnibar_timestamp {
    color: #e5c07b;
}
.sk_theme .omnibar_visitcount {
    color: #98c379;
}
.sk_theme #sk_omnibarSearchResult ul li:nth-child(odd) {
    background: #303030;
}
.sk_theme #sk_omnibarSearchResult ul li.focused {
    background: #3e4452;
}
#sk_status, #sk_find {
    font-size: 20pt;
}`;
// click `S
