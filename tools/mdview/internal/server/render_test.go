package server

import (
	"strings"
	"testing"
)

func TestRenderMarkdownSupportsHeadingsAndTaskLists(t *testing.T) {
	t.Parallel()

	html := renderMarkdown("# Hello\n\n- [x] done")

	if !strings.Contains(html, "<h1") {
		t.Fatalf("expected heading output, got %q", html)
	}

	if !strings.Contains(html, `type="checkbox"`) {
		t.Fatalf("expected task list checkbox output, got %q", html)
	}
}

func TestRenderMarkdownSupportsCodeHighlighting(t *testing.T) {
	t.Parallel()

	html := renderMarkdown("```go\nfunc main() {}\n```")

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

	first := renderMarkdown(input)
	second := renderMarkdown(input)

	if first != second {
		t.Fatalf("expected stable output across calls")
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
		_ = renderMarkdown(content)
	}
}
