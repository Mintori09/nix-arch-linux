package server

import (
	"strings"
	"testing"
)

func TestRenderMarkdownSupportsHeadingsAndTaskLists(t *testing.T) {
	t.Parallel()

	html := renderMarkdown("# Hello\n\n- [x] done", false)

	if !strings.Contains(html, "<h1") {
		t.Fatalf("expected heading output, got %q", html)
	}

	if !strings.Contains(html, `type="checkbox"`) {
		t.Fatalf("expected task list checkbox output, got %q", html)
	}
}

func TestRenderMarkdownSupportsCodeHighlighting(t *testing.T) {
	t.Parallel()

	html := renderMarkdown("```go\nfunc main() {}\n```", false)

	if !strings.Contains(html, `<pre`) || !strings.Contains(html, `style=`) {
		t.Fatalf("expected pre element with style, got %q", html)
	}
}

func TestRenderMarkdownStableAcrossCalls(t *testing.T) {
	t.Parallel()

	input := strings.Join([]string{
		"---",
		"title: sample",
		"---",
		"# Hello",
		"",
		"```go",
		"func main() {}",
		"```",
		"",
		"- [x] done",
	}, "\n")

	first := renderMarkdown(input, false)
	second := renderMarkdown(input, false)

	if first != second {
		t.Fatalf("expected stable output across calls")
	}
}

func TestRenderMarkdownEscapesRawHTMLByDefault(t *testing.T) {
	t.Parallel()

	html := renderMarkdown("<script>alert('x')</script>\n<div>safe</div>", false)

	if strings.Contains(html, "<script>") {
		t.Fatalf("expected script tag to be escaped, got %q", html)
	}

	if strings.Contains(html, "<div>safe</div>") {
		t.Fatalf("expected raw html block to be escaped by default, got %q", html)
	}

	if !strings.Contains(html, "raw HTML omitted") {
		t.Fatalf("expected raw html to be omitted in safe mode, got %q", html)
	}
}

func TestRenderMarkdownAllowsRawHTMLWhenEnabled(t *testing.T) {
	t.Parallel()

	html := renderMarkdown("<div>safe</div>", true)

	if !strings.Contains(html, "<div>safe</div>") {
		t.Fatalf("expected raw html to be preserved when enabled, got %q", html)
	}
}

func BenchmarkRenderMarkdownLargeDocument(b *testing.B) {
	section := strings.Join([]string{
		"## Section",
		"",
		"Some paragraph text for the renderer benchmark.",
		"",
		"```go",
		"func main() {}",
		"```",
		"",
		"- [ ] task",
		"",
	}, "\n")
	content := "# Root\n\n" + strings.Repeat(section, 400)

	b.ReportAllocs()
	for b.Loop() {
		_ = renderMarkdown(content, false)
	}
}
