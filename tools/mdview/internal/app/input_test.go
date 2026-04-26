package app

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"
)

type fakeClipboard struct {
	value string
	err   error
}

func (f fakeClipboard) ReadText(context.Context) (string, error) {
	return f.value, f.err
}

func TestResolveInputPrefersExplicitPath(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	filePath := filepath.Join(dir, "note.md")
	if err := os.WriteFile(filePath, []byte("# note"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	input, err := ResolveInput(context.Background(), ResolveOptions{
		Args:      []string{filePath},
		Stdin:     bytes.NewBufferString("# stdin"),
		Clipboard: fakeClipboard{value: "# clipboard"},
	})
	if err != nil {
		t.Fatalf("ResolveInput returned error: %v", err)
	}

	if input.Kind != InputFile {
		t.Fatalf("expected kind %q, got %q", InputFile, input.Kind)
	}

	if input.Path != filePath {
		t.Fatalf("expected path %q, got %q", filePath, input.Path)
	}
}

func TestResolveInputUsesFolderPath(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	input, err := ResolveInput(context.Background(), ResolveOptions{
		Args: []string{dir},
	})
	if err != nil {
		t.Fatalf("ResolveInput returned error: %v", err)
	}

	if input.Kind != InputFolder {
		t.Fatalf("expected kind %q, got %q", InputFolder, input.Kind)
	}
}

func TestResolveInputUsesStdinBeforeClipboard(t *testing.T) {
	t.Parallel()

	input, err := ResolveInput(context.Background(), ResolveOptions{
		Stdin:     bytes.NewBufferString("# stdin"),
		Clipboard: fakeClipboard{value: "# clipboard"},
		UseClip:   true,
	})
	if err != nil {
		t.Fatalf("ResolveInput returned error: %v", err)
	}

	if input.Kind != InputStdin {
		t.Fatalf("expected kind %q, got %q", InputStdin, input.Kind)
	}

	if input.Content != "# stdin" {
		t.Fatalf("expected stdin content, got %q", input.Content)
	}
}

func TestResolveInputUsesClipboardWithFlag(t *testing.T) {
	t.Parallel()

	input, err := ResolveInput(context.Background(), ResolveOptions{
		UseClip:   true,
		Clipboard: fakeClipboard{value: "# clipboard"},
	})
	if err != nil {
		t.Fatalf("ResolveInput returned error: %v", err)
	}

	if input.Kind != InputClipboard {
		t.Fatalf("expected kind %q, got %q", InputClipboard, input.Kind)
	}

	if input.Content != "# clipboard" {
		t.Fatalf("expected clipboard content, got %q", input.Content)
	}
}

func TestResolveInputReturnsEmptyWhenNothingProvided(t *testing.T) {
	t.Parallel()

	input, err := ResolveInput(context.Background(), ResolveOptions{})
	if err != nil {
		t.Fatalf("ResolveInput returned error: %v", err)
	}

	if input.Kind != InputEmpty {
		t.Fatalf("expected kind %q, got %q", InputEmpty, input.Kind)
	}
}
