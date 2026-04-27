package app

import (
	"context"
	"fmt"
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

		var firstFile string
		for _, f := range files {
			if f.Type == "file" {
				firstFile = f.Path
				break
			}
		}

		if firstFile != "" {
			doc, err := loadFileDocument(filepath.Join(opts.Input.Path, filepath.FromSlash(firstFile)), opts.Input.Path)
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
	snapshot, err := document.SnapshotFile(path)
	if err != nil {
		return session.Document{}, err
	}

	return session.Document{
		Path:         path,
		Name:         filepath.Base(path),
		Content:      snapshot.Content,
		Temporary:    false,
		ReadOnly:     snapshot.ReadOnly,
		LastModified: snapshot.LastModified,
		RevisionID:   snapshot.RevisionID,
		FolderRoot:   root,
	}, nil
}
