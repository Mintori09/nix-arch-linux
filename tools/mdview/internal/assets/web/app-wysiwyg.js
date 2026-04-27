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
  for (const match of raw.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*"([^"]*)")?/g)) {
    const name = match[1]?.toLowerCase();
    if (!name) {
      continue;
    }
    attrs[name] = decodeEntities(match[2] ?? "");
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
      if (
        !selfClosing &&
        tag !== "br" &&
        tag !== "hr" &&
        tag !== "img" &&
        tag !== "input"
      ) {
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

function isElement(node, tag = "") {
  return node?.type === "element" && (!tag || node.tag === tag);
}

function isCheckboxInput(node) {
  return isElement(node, "input") && node.attrs.type === "checkbox";
}

function isCheckedCheckbox(node) {
  if (!isCheckboxInput(node)) {
    return false;
  }

  return Object.hasOwn(node.attrs, "checked") && node.attrs.checked !== "false";
}

function extractTaskItem(node) {
  if (!isElement(node, "li")) {
    return null;
  }

  if (node.attrs["data-type"] === "taskItem") {
    const checked = node.attrs["data-checked"] === "true";
    const contentContainer = node.children.find((child) => isElement(child, "div"));
    return {
      checked,
      contentNodes: contentContainer?.children || [],
    };
  }

  const checkbox = node.children.find(isCheckboxInput);
  if (!checkbox) {
    return null;
  }

  return {
    checked: isCheckedCheckbox(checkbox),
    contentNodes: node.children.filter((child) => child !== checkbox),
  };
}

const BLOCK_TAGS = new Set([
  "article",
  "blockquote",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "ol",
  "p",
  "pre",
  "section",
  "ul",
]);

function hasBlockContent(nodes) {
  return nodes.some((node) => isElement(node) && BLOCK_TAGS.has(node.tag));
}

function renderAttributes(attrs = {}) {
  const parts = [];
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) {
      continue;
    }
    parts.push(value === "" ? name : `${name}="${escapeHTML(String(value))}"`);
  }
  return parts.length ? ` ${parts.join(" ")}` : "";
}

function isCodeBlockWrapper(node) {
  return isElement(node, "div") && node.attrs.class?.split(/\s+/).includes("code-block-wrapper");
}

function isCopyButton(node) {
  return isElement(node, "button") && node.attrs.class?.split(/\s+/).includes("copy-btn");
}

function renderHTMLNode(node) {
  if (node.type === "text") {
    return escapeHTML(node.value);
  }

  if (node.type !== "element") {
    return "";
  }

  if (isCopyButton(node)) {
    return "";
  }

  if (isCodeBlockWrapper(node)) {
    const pre = node.children.find((child) => isElement(child, "pre"));
    if (pre) {
      return renderHTMLNode(pre);
    }
  }

  if (node.tag === "ul" && node.attrs["data-type"] !== "taskList") {
    const taskItems = node.children
      .filter((child) => isElement(child, "li"))
      .map(extractTaskItem);
    if (taskItems.length && taskItems.every(Boolean)) {
      return renderTaskListHTML(taskItems);
    }
  }

  const children = node.children.map(renderHTMLNode).join("");
  if (node.tag === "br" || node.tag === "hr" || node.tag === "img" || node.tag === "input") {
    return `<${node.tag}${renderAttributes(node.attrs)}>`;
  }

  return `<${node.tag}${renderAttributes(node.attrs)}>${children}</${node.tag}>`;
}

function renderTaskListHTML(items) {
  const children = items
    .map((item) => {
      const contentHTML = renderTaskItemContentHTML(item.contentNodes);
      const checkedAttr = item.checked ? ' checked="checked"' : "";
      return `<li data-type="taskItem" data-checked="${item.checked ? "true" : "false"}"><label><input type="checkbox"${checkedAttr}><span></span></label><div>${contentHTML}</div></li>`;
    })
    .join("");

  return `<ul data-type="taskList">${children}</ul>`;
}

function renderTaskItemContentHTML(nodes) {
  const content = nodes.map(renderHTMLNode).join("").trim();
  if (!content) {
    return "<p></p>";
  }

  if (hasBlockContent(nodes)) {
    return content;
  }

  return `<p>${content}</p>`;
}

function serializeInline(node) {
  if (node.type === "text") {
    return node.value.replace(/\s+/g, " ");
  }

  if (node.type !== "element") {
    return "";
  }

  if (isCheckboxInput(node)) {
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
          const taskItem = extractTaskItem(child);
          const marker = taskItem
            ? `- [${taskItem.checked ? "x" : " "}] `
            : node.tag === "ol"
              ? `${index}. `
              : "- ";
          const sourceNodes = taskItem ? taskItem.contentNodes : child.children;
          const text = normalizeWhitespace(
            serializeBlocks(sourceNodes).replace(/\n{2,}/g, "\n"),
          ) || normalizeWhitespace(joinInline(sourceNodes.map(serializeInline)));
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

function normalizePreviewHTMLForWysiwyg(html) {
  return parseHTMLTree(html).children.map(renderHTMLNode).join("");
}

export function getWysiwygInitialContent({ markdown, renderedHTML }) {
  const html = renderedHTML?.trim();
  if (html) {
    return normalizePreviewHTMLForWysiwyg(html);
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
