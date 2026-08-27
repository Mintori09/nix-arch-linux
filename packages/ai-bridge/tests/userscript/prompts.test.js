// @vitest-environment jsdom
import { describe, it, expect } from "vitest";

describe("combineTemplates", () => {
  function combineTemplates(inputText, templateContents) {
    return templateContents
      .map((tmpl) => {
        if (tmpl.includes("{{content}}")) {
          return tmpl.replace(/\{\{content\}\}/g, inputText);
        }
        return tmpl + "\n" + inputText;
      })
      .join("\n\n---\n\n");
  }

  it("replaces {{content}} placeholder", () => {
    const result = combineTemplates("hello world", ["Summarize: {{content}}"]);
    expect(result).toBe("Summarize: hello world");
  });

  it("prepends input when no placeholder", () => {
    const result = combineTemplates("hello world", ["Translate to Vietnamese"]);
    expect(result).toBe("Translate to Vietnamese\nhello world");
  });

  it("joins multiple templates with separator", () => {
    const result = combineTemplates("hello", [
      "A: {{content}}",
      "B: no placeholder",
    ]);
    expect(result).toBe("A: hello\n\n---\n\nB: no placeholder\nhello");
  });

  it("handles empty template list", () => {
    const result = combineTemplates("hello", []);
    expect(result).toBe("");
  });
});

describe("filterPrompts", () => {
  const prompts = [
    { name: "summarize.md", title: "summarize" },
    { name: "translate-vi.md", title: "translate-vi" },
    { name: "code-review.md", title: "code-review" },
  ];

  function filterPrompts(list, query) {
    const q = query.toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.title.toLowerCase().includes(q),
    );
  }

  it("filters by query substring", () => {
    expect(filterPrompts(prompts, "sum")).toHaveLength(1);
    expect(filterPrompts(prompts, "sum")[0].name).toBe("summarize.md");
  });

  it("matches multiple results", () => {
    expect(filterPrompts(prompts, "tra")).toHaveLength(1);
  });

  it("returns empty for no match", () => {
    expect(filterPrompts(prompts, "zzz")).toHaveLength(0);
  });
});
