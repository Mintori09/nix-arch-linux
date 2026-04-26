package app

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/mintori/home-manager/tools/mdview/internal/config"
	"github.com/mintori/home-manager/tools/mdview/internal/document"
	"github.com/mintori/home-manager/tools/mdview/internal/session"
)

type BuildOptions struct {
	Input  Input
	Config config.Config
	Token  string
}

func BuildSession(_ context.Context, opts BuildOptions) (*session.App, error) {
	appState := &session.App{
		Token:  opts.Token,
		Config: opts.Config,
	}

	switch opts.Input.Kind {
	case InputFile:
		doc, err := loadFileDocument(opts.Input.Path, "")
		if err != nil {
			return nil, err
		}
		appState.SetDocument(doc)
	case InputFolder:
		appState.Root = opts.Input.Path
		files, err := document.ListMarkdownFiles(opts.Input.Path)
		if err != nil {
			return nil, fmt.Errorf("list folder markdown files: %w", err)
		}

		if len(files) > 0 {
			doc, err := loadFileDocument(filepath.Join(opts.Input.Path, filepath.FromSlash(files[0].Path)), opts.Input.Path)
			if err != nil {
				return nil, err
			}
			appState.SetDocument(doc)
		} else {
			appState.SetDocument(session.Document{
				Name:       "Untitled",
				Temporary:  true,
				FolderRoot: opts.Input.Path,
			})
		}
	case InputClipboard:
		appState.SetDocument(session.Document{
			Name:      "Clipboard",
			Content:   opts.Input.Content,
			Temporary: true,
		})
	case InputStdin:
		appState.SetDocument(session.Document{
			Name:      "stdin.md",
			Content:   opts.Input.Content,
			Temporary: true,
		})
	default:
		appState.SetDocument(session.Document{
			Name:      "Untitled",
			Temporary: true,
		})
	}

	return appState, nil
}

func loadFileDocument(path, root string) (session.Document, error) {
	info, err := os.Stat(path)
	if err != nil {
		return session.Document{}, fmt.Errorf("stat document: %w", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return session.Document{}, fmt.Errorf("read document: %w", err)
	}

	return session.Document{
		Path:       path,
		Name:       filepath.Base(path),
		Content:    string(data),
		Temporary:  false,
		ReadOnly:   info.Mode().Perm()&0o200 == 0,
		FolderRoot: root,
	}, nil
}
