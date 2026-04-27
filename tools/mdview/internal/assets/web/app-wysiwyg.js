function decodeEntities(value) {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function escapeHTML(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function parseAttributes(raw) {
  const attrs = {};
  for (const match of raw.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"/g)) {
    attrs[match[1].toLowerCase()] = decodeEntities(match[2]);
  }
  return attrs;
}

function tokenizeHTML(html) {
  return html.match(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g) || [];
}

function parseHTMLTree(html) {
  const root = { type: "root", children: [] };
  const stack = [root];

  for (const token of tokenizeHTML(html)) {
    if (!token || token.startsWith("<!--")) {
      continue;
    }

    if (token.startsWith("</")) {
      const tag = token.slice(2, -1).trim().toLowerCase();
      while (stack.length > 1) {
        const node = stack.pop();
        if (node.tag === tag) {
          break;
        }
      }
      continue;
    }

    if (token.startsWith("<")) {
      const inner = token.slice(1, -1).trim();
      const selfClosing = inner.endsWith("/");
      const cleaned = selfClosing ? inner.slice(0, -1).trim() : inner;
      const space = cleaned.search(/\s/);
      const tag = (space === -1 ? cleaned : cleaned.slice(0, space)).toLowerCase();
      const rawAttrs = space === -1 ? "" : cleaned.slice(space + 1);
      const node = {
        type: "element",
        tag,
        attrs: parseAttributes(rawAttrs),
        children: [],
      };
      stack.at(-1).children.push(node);
      if (!selfClosing && tag !== "br" && tag !== "hr" && tag !== "img") {
        stack.push(node);
      }
      continue;
    }

    const text = decodeEntities(token);
    if (text) {
      stack.at(-1).children.push({ type: "text", value: text });
    }
  }

  return root;
}

function joinInline(parts) {
  return parts.join("").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n");
}

function serializeInline(node) {
  if (node.type === "text") {
    return node.value.replace(/\s+/g, " ");
  }

  if (node.type !== "element") {
    return "";
  }

  const children = joinInline(node.children.map(serializeInline));
  switch (node.tag) {
    case "strong":
    case "b":
      return children ? `**${children}**` : "";
    case "em":
    case "i":
      return children ? `*${children}*` : "";
    case "code":
      return `\`${children}\``;
    case "a":
      return `[${children || node.attrs.href || ""}](${node.attrs.href || ""})`;
    case "br":
      return "\n";
    default:
      return children;
  }
}

function serializeBlocks(nodes, indent = "") {
  const blocks = [];

  for (const node of nodes) {
    if (node.type === "text") {
      const text = normalizeWhitespace(node.value);
      if (text) {
        blocks.push(`${indent}${text}`);
      }
      continue;
    }

    if (node.type !== "element") {
      continue;
    }

    switch (node.tag) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        const level = Number(node.tag.slice(1));
        const text = normalizeWhitespace(joinInline(node.children.map(serializeInline)));
        if (text) {
          blocks.push(`${indent}${"#".repeat(level)} ${text}`);
        }
        break;
      }
      case "p": {
        const text = normalizeWhitespace(joinInline(node.children.map(serializeInline)));
        if (text) {
          blocks.push(`${indent}${text}`);
        }
        break;
      }
      case "blockquote": {
        const nested = serializeBlocks(node.children)
          .split("\n")
          .filter(Boolean)
          .map((line) => `${indent}> ${line}`)
          .join("\n");
        if (nested) {
          blocks.push(nested);
        }
        break;
      }
      case "ul":
      case "ol": {
        let index = 1;
        for (const child of node.children.filter((entry) => entry.tag === "li")) {
          const marker = node.tag === "ol" ? `${index}. ` : "- ";
          const text = normalizeWhitespace(
            joinInline(child.children.map(serializeInline)),
          );
          if (text) {
            blocks.push(`${indent}${marker}${text}`);
          }
          index++;
        }
        break;
      }
      case "pre": {
        const codeNode = node.children.find((child) => child.tag === "code");
        const code = (codeNode ? codeNode.children : node.children)
          .map((child) => (child.type === "text" ? child.value : serializeInline(child)))
          .join("")
          .replace(/\n+$/, "");
        blocks.push(`${indent}\`\`\`\n${code}\n\`\`\``);
        break;
      }
      case "hr":
        blocks.push(`${indent}---`);
        break;
      case "div":
      case "section":
      case "article":
        blocks.push(serializeBlocks(node.children, indent));
        break;
      default: {
        const text = normalizeWhitespace(joinInline(node.children.map(serializeInline)));
        if (text) {
          blocks.push(`${indent}${text}`);
        }
        break;
      }
    }
  }

  return blocks
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function markdownParagraphs(markdown) {
  return markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (/^#{1,6}\s/.test(block)) {
        const [, hashes, text] = block.match(/^(#{1,6})\s+(.*)$/) || [];
        return `<h${hashes.length}>${escapeHTML(text || "")}</h${hashes.length}>`;
      }
      return `<p>${escapeHTML(block).replace(/\n/g, "<br />")}</p>`;
    })
    .join("");
}

export function getWysiwygInitialContent({ markdown, renderedHTML }) {
  const html = renderedHTML?.trim();
  if (html) {
    return html;
  }
  return markdownParagraphs(markdown || "");
}

export function htmlToMarkdown(html) {
  return serializeBlocks(parseHTMLTree(html).children);
}

export function getEditorContentForSaving({ viewMode, plainText, html }) {
  if (viewMode === "wysiwyg") {
    const markdown = htmlToMarkdown(html || "");
    return markdown || (plainText || "");
  }
  return plainText || "";
}

export function getVimIndicatorState({ viewMode, vimMode }) {
  if (viewMode !== "wysiwyg") {
    return {
      hidden: true,
      text: "",
      tone: "",
    };
  }

  const mode = vimMode === "normal" || vimMode === "visual" ? vimMode : "insert";
  return {
    hidden: false,
    text: mode.toUpperCase(),
    tone: mode,
  };
}

export function getVimKeyAction({ vimMode, key, isCtrl }) {
  if (vimMode === "insert") {
    if (key === "Escape") {
      return {
        type: "set-mode",
        mode: "normal",
      };
    }
    return null;
  }

  if (vimMode === "visual") {
    if (key === "Escape") {
      return {
        type: "set-mode",
        mode: "normal",
        collapseSelection: true,
      };
    }

    const motion = getHorizontalMotion(key, isCtrl);
    if (motion) {
      return {
        type: "command",
        command: motion,
        extend: true,
      };
    }

    return null;
  }

  if (vimMode !== "normal") {
    return null;
  }

  if (key === "Escape") {
    return { type: "noop" };
  }

  if (!isCtrl && key === "v") {
    return {
      type: "set-mode",
      mode: "visual",
    };
  }

  if (!isCtrl && key === "i") {
    return {
      type: "set-mode",
      mode: "insert",
    };
  }

  if (!isCtrl && key === "a") {
    return {
      type: "command",
      command: "moveCursorForward",
      mode: "insert",
    };
  }

  if (key === "A") {
    return {
      type: "command",
      command: "moveCursorToEnd",
      mode: "insert",
    };
  }

  if (!isCtrl && key === "o") {
    return {
      type: "command-sequence",
      commands: ["moveCursorToEnd", "insertContentNewline"],
      mode: "insert",
    };
  }

  if (!isCtrl && key === "O") {
    return {
      type: "command-sequence",
      commands: ["moveCursorToStart", "insertContentNewline", "moveCursorBackward"],
      mode: "insert",
    };
  }

  const motion = getHorizontalMotion(key, isCtrl);
  if (motion) {
    return {
      type: "command",
      command: motion,
    };
  }

  if (!isCtrl && key === "u") {
    return {
      type: "command",
      command: "undo",
    };
  }

  if (!isCtrl && (key === "x" || key === "d")) {
    return {
      type: "command",
      command: "deleteSelection",
    };
  }

  return null;
}

function getHorizontalMotion(key, isCtrl) {
  if (isCtrl) {
    return null;
  }

  switch (key) {
    case "h":
    case "b":
      return "moveCursorBackward";
    case "l":
    case "w":
      return "moveCursorForward";
    case "0":
      return "moveCursorToStartOfLine";
    case "$":
      return "moveCursorToEndOfLine";
    default:
      return null;
  }
}
