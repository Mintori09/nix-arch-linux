package document

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type Store struct{}

func (Store) SaveAtomic(_ context.Context, path string, content []byte) error {
	dir := filepath.Dir(path)
	base := filepath.Base(path)
	tempPath := filepath.Join(dir, fmt.Sprintf(".%s.%d.tmp", base, time.Now().UnixNano()))

	if err := os.WriteFile(tempPath, content, 0o644); err != nil {
		return fmt.Errorf("write temp file: %w", err)
	}

	if err := os.Rename(tempPath, path); err != nil {
		_ = os.Remove(tempPath)
		return fmt.Errorf("rename temp file: %w", err)
	}

	return nil
}

type FileEntry struct {
	Path string `json:"path"`
	Name string `json:"name"`
	Type string `json:"type"`
}

func ListMarkdownFiles(root string) ([]FileEntry, error) {
	var files []FileEntry

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if strings.ToLower(filepath.Ext(d.Name())) != ".md" {
			return nil
		}

		relative, err := filepath.Rel(root, path)
		if err != nil {
			return fmt.Errorf("get relative path: %w", err)
		}

		files = append(files, FileEntry{
			Path: filepath.ToSlash(relative),
			Name: d.Name(),
			Type: "file",
		})
		return nil
	})
	if err != nil {
		return nil, err
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].Path < files[j].Path
	})

	return files, nil
}
