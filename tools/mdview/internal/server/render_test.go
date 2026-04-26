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
