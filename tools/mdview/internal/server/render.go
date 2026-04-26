package server

import (
	"bytes"
	"regexp"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	renderhtml "github.com/yuin/goldmark/renderer/html"
)

func renderMarkdown(content string) string {
	markdown := goldmark.New(
		goldmark.WithExtensions(extension.GFM, extension.DefinitionList, extension.Footnote, extension.Table),
		goldmark.WithParserOptions(parser.WithAutoHeadingID()),
		goldmark.WithRendererOptions(renderhtml.WithUnsafe()),
	)

	source := stripFrontmatter(content)
	var buf bytes.Buffer
	if err := markdown.Convert([]byte(source), &buf); err != nil {
		return "<pre>Failed to render markdown.</pre>"
	}
	return buf.String()
}

var frontmatterPattern = regexp.MustCompile(`(?s)\A---\n.*?\n---\n?`)

func stripFrontmatter(content string) string {
	return frontmatterPattern.ReplaceAllString(content, "")
}
