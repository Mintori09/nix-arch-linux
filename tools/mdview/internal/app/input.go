package app

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"strings"
)

type InputKind string

const (
	InputEmpty     InputKind = "empty"
	InputFile      InputKind = "file"
	InputFolder    InputKind = "folder"
	InputStdin     InputKind = "stdin"
	InputClipboard InputKind = "clipboard"
)

type ClipboardReader interface {
	ReadText(context.Context) (string, error)
}

type ResolveOptions struct {
	Args      []string
	Stdin     io.Reader
	Clipboard ClipboardReader
	UseClip   bool
}

type Input struct {
	Kind    InputKind
	Path    string
	Content string
}

func ResolveInput(ctx context.Context, opts ResolveOptions) (Input, error) {
	if len(opts.Args) > 0 {
		return resolvePath(opts.Args[0])
	}

	if content, ok, err := readText(opts.Stdin); err != nil {
		return Input{}, err
	} else if ok {
		return Input{Kind: InputStdin, Content: content}, nil
	}

	if opts.UseClip && opts.Clipboard != nil {
		text, err := opts.Clipboard.ReadText(ctx)
		if err != nil {
			return Input{}, fmt.Errorf("read clipboard: %w", err)
		}
		return Input{Kind: InputClipboard, Content: text}, nil
	}

	return Input{Kind: InputEmpty}, nil
}

func resolvePath(path string) (Input, error) {
	info, err := os.Stat(path)
	if err != nil {
		return Input{}, fmt.Errorf("stat path %q: %w", path, err)
	}

	switch {
	case info.IsDir():
		return Input{Kind: InputFolder, Path: path}, nil
	case info.Mode().IsRegular():
		return Input{Kind: InputFile, Path: path}, nil
	default:
		return Input{}, fmt.Errorf("unsupported path type for %q", path)
	}
}

func readText(r io.Reader) (string, bool, error) {
	if r == nil {
		return "", false, nil
	}

	type statter interface {
		Stat() (fs.FileInfo, error)
	}

	if s, ok := r.(statter); ok {
		info, err := s.Stat()
		if err == nil && info.Mode()&os.ModeCharDevice != 0 {
			return "", false, nil
		}
	}

	data, err := io.ReadAll(r)
	if err != nil {
		return "", false, err
	}

	if len(data) == 0 {
		return "", false, nil
	}

	text := strings.TrimRight(string(data), "\n")
	if strings.TrimSpace(text) == "" {
		return "", false, nil
	}

	return text, true, nil
}

var ErrClipboardUnavailable = errors.New("clipboard unavailable")
