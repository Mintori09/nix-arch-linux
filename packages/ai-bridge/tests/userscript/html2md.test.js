// @vitest-environment jsdom
import { describe, it, expect } from "vitest";

// Copy function inline (same pattern as resolve-filename.test.js)
function htmlToMarkdown(el) {
  if (!el) return "";
  if (typeof el === "string") {
    el = new DOMParser().parseFromString(el, "text/html").body;
  }

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const tag = node.tagName.toLowerCase();
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

      case "p":
        return children.trim() + "\n\n";
      case "br":
        return "\n";
      case "hr":
        return "---\n\n";

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
        if (
          node.parentElement &&
          node.parentElement.tagName.toLowerCase() === "pre"
        ) {
          return node.textContent;
        }
        return "`" + node.textContent + "`";
      }

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

      case "table":
        return "\n" + convertTable(node) + "\n";

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

// Helper: create element from HTML string (returns first element child)
function el(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  // Find first element node (skip text/whitespace nodes)
  for (const child of div.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE) return child;
  }
  return div;
}

describe("htmlToMarkdown()", () => {
  describe("edge cases", () => {
    it("returns empty string for null input", () => {
      expect(htmlToMarkdown(null)).toBe("");
    });

    it("returns empty string for empty element", () => {
      const div = document.createElement("div");
      expect(htmlToMarkdown(div)).toBe("");
    });

    it("accepts HTML string input (innerHTML)", () => {
      expect(htmlToMarkdown("<p>Hello</p>")).toBe("Hello");
      expect(htmlToMarkdown("<strong>Bold</strong>")).toBe("**Bold**");
    });
  });

  describe("headings", () => {
    it("converts h1-h6", () => {
      expect(htmlToMarkdown(el("<h1>Title</h1>"))).toBe("# Title");
      expect(htmlToMarkdown(el("<h2>Subtitle</h2>"))).toBe("## Subtitle");
      expect(htmlToMarkdown(el("<h3>Section</h3>"))).toBe("### Section");
      expect(htmlToMarkdown(el("<h4>Subsection</h4>"))).toBe("#### Subsection");
      expect(htmlToMarkdown(el("<h5>Detail</h5>"))).toBe("##### Detail");
      expect(htmlToMarkdown(el("<h6>Small</h6>"))).toBe("###### Small");
    });
  });

  describe("block elements", () => {
    it("converts paragraphs", () => {
      expect(htmlToMarkdown(el("<p>Hello world</p>"))).toBe("Hello world");
    });

    it("converts br to newline", () => {
      expect(htmlToMarkdown(el("<p>Line1<br>Line2</p>"))).toBe("Line1\nLine2");
    });

    it("converts hr to ---", () => {
      expect(htmlToMarkdown(el("<hr>"))).toBe("---");
    });
  });

  describe("code", () => {
    it("converts pre+code with language class to fenced block", () => {
      const html =
        '<pre><code class="language-python">print("hi")</code></pre>';
      expect(htmlToMarkdown(el(html))).toBe('```python\nprint("hi")\n```');
    });

    it("converts pre without code to fenced block", () => {
      expect(htmlToMarkdown(el("<pre>raw code</pre>"))).toBe(
        "```\nraw code\n```",
      );
    });

    it("converts inline code to backticks", () => {
      expect(
        htmlToMarkdown(el("<p>Use <code>npm install</code> here</p>")),
      ).toBe("Use `npm install` here");
    });
  });

  describe("inline formatting", () => {
    it("converts strong/b to bold", () => {
      expect(htmlToMarkdown(el("<strong>bold</strong>"))).toBe("**bold**");
      expect(htmlToMarkdown(el("<b>bold</b>"))).toBe("**bold**");
    });

    it("converts em/i to italic", () => {
      expect(htmlToMarkdown(el("<em>italic</em>"))).toBe("*italic*");
      expect(htmlToMarkdown(el("<i>italic</i>"))).toBe("*italic*");
    });

    it("converts del to strikethrough", () => {
      expect(htmlToMarkdown(el("<del>deleted</del>"))).toBe("~~deleted~~");
    });
  });

  describe("links and images", () => {
    it("converts anchor to markdown link", () => {
      expect(
        htmlToMarkdown(el('<a href="https://example.com">Click</a>')),
      ).toBe("[Click](https://example.com)");
    });

    it("converts anchor without href to plain text", () => {
      expect(htmlToMarkdown(el("<a>No href</a>"))).toBe("No href");
    });

    it("converts img to markdown image", () => {
      expect(htmlToMarkdown(el('<img src="pic.png" alt="Photo">'))).toBe(
        "![Photo](pic.png)",
      );
    });
  });

  describe("lists", () => {
    it("converts unordered list", () => {
      const html = "<ul><li>Apple</li><li>Banana</li></ul>";
      expect(htmlToMarkdown(el(html))).toBe("- Apple\n- Banana");
    });

    it("converts ordered list", () => {
      const html = "<ol><li>First</li><li>Second</li></ol>";
      expect(htmlToMarkdown(el(html))).toBe("1. First\n2. Second");
    });
  });

  describe("tables", () => {
    it("converts table with header and rows", () => {
      const html = `
        <table>
          <tr><th>Name</th><th>Age</th></tr>
          <tr><td>Alice</td><td>30</td></tr>
          <tr><td>Bob</td><td>25</td></tr>
        </table>
      `;
      const expected =
        "| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |";
      expect(htmlToMarkdown(el(html))).toBe(expected);
    });
  });

  describe("cleanup", () => {
    it("collapses multiple newlines to double newline", () => {
      const html = "<p>A</p><p>B</p><p>C</p>";
      const result = htmlToMarkdown(el(html));
      expect(result).not.toMatch(/\n{3,}/);
    });
  });

  describe("realistic Gemini response", () => {
    it("converts a full response with mixed elements", () => {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = `
        <h2>Python Function</h2>
        <p>Here is a function with a <strong>docstring</strong>:</p>
        <pre><code class="language-python">def greet(name):
    """Greet someone."""
    return f"Hello, {name}!"</code></pre>
        <p>Features:</p>
        <ul>
          <li>Type hints</li>
          <li>Docstring</li>
        </ul>
        <p>See <a href="https://docs.python.org">Python docs</a> for more.</p>
      `;
      const result = htmlToMarkdown(wrapper);
      expect(result).toContain("## Python Function");
      expect(result).toContain("**docstring**");
      expect(result).toContain("```python\ndef greet(name):");
      expect(result).toContain("- Type hints");
      expect(result).toContain("- Docstring");
      expect(result).toContain("[Python docs](https://docs.python.org)");
    });
  });

  describe("Gemini formatted code blocks", () => {
    it("skips aria-hidden elements (UI icons, decorative spans)", () => {
      const html =
        '<p>Hello <mat-icon aria-hidden="true">settings</mat-icon> world</p>';
      expect(htmlToMarkdown(el(html))).toBe("Hello  world");
    });

    it("skips script and style tags", () => {
      const html =
        "<p>Visible</p><script>var x = 1;</script><style>.cls{}</style><p>More</p>";
      expect(htmlToMarkdown(html)).toBe("Visible\n\nMore");
    });

    it("extracts language from sibling header span when code block lacks language-* class", () => {
      const html = [
        "<div>",
        '  <div class="code-block-decoration header-formatted">',
        "    <span>JavaScript</span>",
        "  </div>",
        '  <pre><code class="code-container formatted">const x = 42;</code></pre>',
        "</div>",
      ].join("");
      expect(htmlToMarkdown(el(html))).toBe(
        "```javascript\nconst x = 42;\n```",
      );
    });

    it("handles full Gemini code block structure with Angular attributes and highlighted spans", () => {
      const html = [
        '<div _ngcontent-ng-c1="" class="formatted-code-block-internal-container">',
        '  <div _ngcontent-ng-c1="" class="animated-opacity">',
        '    <div _ngcontent-ng-c1="" class="code-block-decoration header-formatted">',
        '      <span _ngcontent-ng-c1="">JavaScript</span>',
        '      <div _ngcontent-ng-c1="" class="buttons">',
        '        <gem-icon-button _ngcontent-ng-c1="" fonticonname="arrow_circle_down" arialabel="Download code">',
        '          <button aria-label="Download code">',
        "            <gem-icon>",
        '              <mat-icon aria-hidden="true" fonticon="arrow_circle_down"></mat-icon>',
        "            </gem-icon>",
        "          </button>",
        "        </gem-icon-button>",
        '        <gem-icon-button _ngcontent-ng-c1="" fonticonname="copy" arialabel="Copy code">',
        '          <button aria-label="Copy code">',
        "            <gem-icon>",
        '              <mat-icon aria-hidden="true" fonticon="copy"></mat-icon>',
        "            </gem-icon>",
        "          </button>",
        "        </gem-icon-button>",
        "      </div>",
        "    </div>",
        '    <pre _ngcontent-ng-c1="" class="ng-tns-c1-1">',
        '      <code _ngcontent-ng-c1="" role="text" data-test-id="code-content" class="code-container formatted"><span class="hljs-comment">// ==UserScript==</span>',
        '<span class="hljs-keyword">const </span><span class="hljs-variable">x</span><span class="hljs-operator"> = </span><span class="hljs-number">42</span><span class="hljs-punctuation">;</span></code>',
        "    </pre>",
        "  </div>",
        "</div>",
      ].join("\n");
      const result = htmlToMarkdown(el(html));
      expect(result).toBe(
        "```javascript\n// ==UserScript==\nconst x = 42;\n```",
      );
    });
  });
});
