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

type WorkspaceRoot struct {
	Path    string      `json:"path"`
	Name    string      `json:"name"`
	Entries []FileEntry `json:"entries"`
}

func ListMarkdownFiles(root string) ([]FileEntry, error) {
	entries, err := listWorkspaceEntries(root, false)
	if err != nil {
		return nil, err
	}
	filtered := entries[:0]
	for _, entry := range entries {
		if entry.Type == "directory" {
			continue
		}
		filtered = append(filtered, entry)
	}
	dirs := directoriesFromMarkdownFiles(filtered)
	filtered = append(filtered, dirs...)
	sortEntries(filtered)
	return filtered, nil
}

func ListWorkspaceEntries(root string) ([]FileEntry, error) {
	return listWorkspaceEntries(root, true)
}

func ListWorkspaceRoots(roots []string) ([]WorkspaceRoot, error) {
	items := make([]WorkspaceRoot, 0, len(roots))
	for _, root := range roots {
		entries, err := ListWorkspaceEntries(root)
		if err != nil {
			return nil, err
		}
		items = append(items, WorkspaceRoot{
			Path:    root,
			Name:    filepath.Base(root),
			Entries: entries,
		})
	}
	return items, nil
}

func listWorkspaceEntries(root string, includeAllDirs bool) ([]FileEntry, error) {
	var entries []FileEntry
	dirs := make(map[string]bool)

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if path == root {
			return nil
		}

		relative, err := filepath.Rel(root, path)
		if err != nil {
			return fmt.Errorf("get relative path: %w", err)
		}
		relative = filepath.ToSlash(relative)

		if d.IsDir() {
			if includeAllDirs {
				dirs[relative] = true
			}
			return nil
		}
		if strings.ToLower(filepath.Ext(d.Name())) != ".md" {
			return nil
		}

		entries = append(entries, FileEntry{
			Path: relative,
			Name: d.Name(),
			Type: "file",
		})

		if !includeAllDirs {
			dir := filepath.Dir(relative)
			for dir != "." && dir != "" {
				dirs[filepath.ToSlash(dir)] = true
				dir = filepath.Dir(dir)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	for dir := range dirs {
		entries = append(entries, FileEntry{
			Path: dir + "/",
			Name: filepath.Base(dir),
			Type: "directory",
		})
	}

	sortEntries(entries)
	return entries, nil
}

func directoriesFromMarkdownFiles(files []FileEntry) []FileEntry {
	dirs := make(map[string]bool)
	for _, entry := range files {
		dir := filepath.Dir(entry.Path)
		for dir != "." && dir != "" {
			dirs[filepath.ToSlash(dir)] = true
			dir = filepath.Dir(dir)
		}
	}

	entries := make([]FileEntry, 0, len(dirs))
	for dir := range dirs {
		entries = append(entries, FileEntry{
			Path: dir + "/",
			Name: filepath.Base(dir),
			Type: "directory",
		})
	}
	return entries
}

func sortEntries(entries []FileEntry) {
	sort.Slice(entries, func(i, j int) bool {
		a, b := entries[i], entries[j]
		if a.Type != b.Type {
			return a.Type == "directory"
		}
		return a.Path < b.Path
	})
}
