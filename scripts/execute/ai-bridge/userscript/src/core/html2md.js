// html2md.js — Lightweight HTML-to-Markdown converter
// Converts a DOM element's innerHTML to Markdown text.

function htmlToMarkdown(el) {
  if (!el) return "";
  // If string (innerHTML), parse into DOM element via DOMParser (CSP-safe)
  if (typeof el === "string") {
    el = new DOMParser().parseFromString(el, "text/html").body;
  }

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const tag = node.tagName.toLowerCase();

    // Skip non-content elements
    if (tag === "script" || tag === "style") return "";
    if (node.getAttribute("aria-hidden") === "true") return "";

    // Pre-scan: identify label siblings consumed by code blocks (Gemini format)
    const childArr = Array.from(node.childNodes);
    const consumed = new Set();
    for (let i = 0; i < childArr.length; i++) {
      const c = childArr[i];
      if (
        c.nodeType === Node.ELEMENT_NODE &&
        c.tagName.toLowerCase() === "pre"
      ) {
        for (let j = i - 1; j >= 0; j--) {
          const prev = childArr[j];
          if (prev.nodeType === Node.ELEMENT_NODE && !consumed.has(j)) {
            const span = prev.querySelector(":scope > span");
            if (span && span.textContent.trim().length < 30) {
              consumed.add(j);
            }
            break;
          }
        }
      }
    }
    const children = childArr
      .filter((_, i) => !consumed.has(i))
      .map(walk)
      .join("");

    switch (tag) {
      // Headings
      case "h1":
        return "# " + children.trim() + "\n\n";
      case "h2":
        return "## " + children.trim() + "\n\n";
      case "h3":
        return "### " + children.trim() + "\n\n";
      case "h4":
        return "#### " + children.trim() + "\n\n";
      case "h5":
        return "##### " + children.trim() + "\n\n";
      case "h6":
        return "###### " + children.trim() + "\n\n";

      // Block elements
      case "p":
        return children.trim() + "\n\n";
      case "br":
        return "\n";
      case "hr":
        return "---\n\n";

      // Code
      case "pre": {
        const codeEl = node.querySelector("code");
        let lang = codeEl
          ? (codeEl.className.match(/language-(\S+)/) || [])[1] || ""
          : "";

        // Fallback: check previous sibling for a language label (Gemini format)
        if (!lang) {
          const prev = node.previousElementSibling;
          if (prev) {
            const labelSpan = prev.querySelector(":scope > span");
            if (labelSpan) {
              const text = labelSpan.textContent.trim();
              if (text && text.length < 30) {
                lang = text.toLowerCase();
              }
            }
          }
        }

        const code = (codeEl ? codeEl.textContent : node.textContent).trim();
        return "```" + lang + "\n" + code + "\n```\n\n";
      }
      case "code": {
        // Inline code — only if not inside <pre>
        if (
          node.parentElement &&
          node.parentElement.tagName.toLowerCase() === "pre"
        ) {
          return node.textContent;
        }
        return "`" + node.textContent + "`";
      }

      // Inline formatting
      case "strong":
      case "b":
        return "**" + node.textContent.trim() + "**";
      case "em":
      case "i":
        return "*" + node.textContent.trim() + "*";
      case "del":
      case "s":
      case "strike":
        return "~~" + node.textContent.trim() + "~~";

      // Links and images
      case "a": {
        const href = node.getAttribute("href");
        const text = node.textContent.trim();
        if (!href) return text;
        return "[" + text + "](" + href + ")";
      }
      case "img": {
        const src = node.getAttribute("src") || "";
        const alt = node.getAttribute("alt") || "";
        return "![" + alt + "](" + src + ")";
      }

      // Lists
      case "ul":
        return "\n" + children + "\n";
      case "ol":
        return "\n" + children + "\n";
      case "li": {
        const parent = node.parentElement;
        if (!parent) return "- " + children.trim() + "\n";
        const isOrdered = parent.tagName.toLowerCase() === "ol";
        if (isOrdered) {
          const idx = Array.from(parent.children).indexOf(node) + 1;
          return idx + ". " + children.trim() + "\n";
        }
        return "- " + children.trim() + "\n";
      }

      // Table
      case "table":
        return "\n" + convertTable(node) + "\n";

      // Ignore everything else, just return children
      default:
        return children;
    }
  }

  function convertTable(tableEl) {
    const rows = Array.from(tableEl.querySelectorAll("tr"));
    if (rows.length === 0) return "";

    const result = [];
    rows.forEach((row, rowIdx) => {
      const cells = Array.from(row.querySelectorAll("th, td"));
      const line =
        "| " + cells.map((c) => c.textContent.trim()).join(" | ") + " |";
      result.push(line);

      // Add separator after first row
      if (rowIdx === 0) {
        const sep = "| " + cells.map(() => "---").join(" | ") + " |";
        result.push(sep);
      }
    });

    return result.join("\n");
  }

  return walk(el)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
