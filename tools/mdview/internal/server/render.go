package server

import (
	"bytes"
	"regexp"
	"sync"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	renderhtml "github.com/yuin/goldmark/renderer/html"

	highlighting "github.com/yuin/goldmark-highlighting/v2"
)

var (
	markdownRendererSafe = goldmark.New(
		goldmark.WithExtensions(
			extension.GFM,
			extension.DefinitionList,
			extension.Footnote,
			extension.Table,
			highlighting.NewHighlighting(
				highlighting.WithStyle("monokai"),
			),
		),
		goldmark.WithParserOptions(parser.WithAutoHeadingID()),
	)
	markdownRendererUnsafe = goldmark.New(
		goldmark.WithExtensions(
			extension.GFM,
			extension.DefinitionList,
			extension.Footnote,
			extension.Table,
			highlighting.NewHighlighting(
				highlighting.WithStyle("monokai"),
			),
		),
		goldmark.WithParserOptions(parser.WithAutoHeadingID()),
		goldmark.WithRendererOptions(renderhtml.WithUnsafe()),
	)
)

var markdownBufferPool = sync.Pool{
	New: func() any {
		return new(bytes.Buffer)
	},
}

func renderMarkdown(content string, allowRawHTML bool) string {
	source := stripFrontmatter(content)
	buf := markdownBufferPool.Get().(*bytes.Buffer)
	buf.Reset()
	defer func() {
		buf.Reset()
		markdownBufferPool.Put(buf)
	}()

	renderer := markdownRendererSafe
	if allowRawHTML {
		renderer = markdownRendererUnsafe
	}

	if err := renderer.Convert([]byte(source), buf); err != nil {
		return "<pre>Failed to render markdown.</pre>"
	}
	return buf.String()
}

var frontmatterPattern = regexp.MustCompile(`(?s)\A---\n.*?\n---\n?`)

func stripFrontmatter(content string) string {
	return frontmatterPattern.ReplaceAllString(content, "")
}
