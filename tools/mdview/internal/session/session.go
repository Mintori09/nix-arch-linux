package session

import (
	"sync"
	"time"

	"github.com/mintori/home-manager/tools/mdview/internal/config"
	"github.com/mintori/home-manager/tools/mdview/internal/document"
)

type Document struct {
	Path       string    `json:"path,omitempty"`
	Name       string    `json:"name"`
	Content    string    `json:"content"`
	Temporary  bool      `json:"temporary"`
	Dirty      bool      `json:"dirty"`
	ReadOnly   bool      `json:"read_only"`
	SavedAt    time.Time `json:"saved_at,omitempty"`
	FolderRoot string    `json:"folder_root,omitempty"`
}

type App struct {
	mu       sync.RWMutex
	Token    string
	Config   config.Config
	Document Document
	Root     string
}

func (a *App) Snapshot() (config.Config, Document, string) {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.Config, a.Document, a.Root
}

func (a *App) SetDocument(doc Document) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.Document = doc
}

func (a *App) UpdateDocument(content string, savedAt time.Time) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.Document.Content = content
	a.Document.Dirty = false
	a.Document.SavedAt = savedAt
}

func (a *App) SetConfig(cfg config.Config) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.Config = cfg
}

func (a *App) MarkdownFiles() ([]document.FileEntry, error) {
	a.mu.RLock()
	root := a.Root
	a.mu.RUnlock()
	if root == "" {
		return nil, nil
	}
	return document.ListMarkdownFiles(root)
}
