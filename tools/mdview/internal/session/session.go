package session

import (
	"sync"
	"time"

	"github.com/mintori/home-manager/tools/mdview/internal/config"
	"github.com/mintori/home-manager/tools/mdview/internal/document"
)

type Document struct {
	Path         string    `json:"path,omitempty"`
	Name         string    `json:"name"`
	Content      string    `json:"content"`
	Temporary    bool      `json:"temporary"`
	Dirty        bool      `json:"dirty"`
	ReadOnly     bool      `json:"read_only"`
	SavedAt      time.Time `json:"saved_at,omitempty"`
	LastModified time.Time `json:"last_modified,omitempty"`
	RevisionID   string    `json:"revision_id,omitempty"`
	FolderRoot   string    `json:"folder_root,omitempty"`
}

type App struct {
	mu             sync.RWMutex
	Token          string
	Presence       *PresenceMonitor
	Config         config.Config
	Document       Document
	WorkspaceRoots []string
}

func (a *App) Snapshot() (config.Config, Document, []string) {
	a.mu.RLock()
	defer a.mu.RUnlock()
	roots := append([]string(nil), a.WorkspaceRoots...)
	return a.Config, a.Document, roots
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
	a.WorkspaceRoots = append([]string(nil), cfg.WorkspaceRoots...)
}

func (a *App) SetWorkspaceRoots(roots []string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.WorkspaceRoots = append([]string(nil), roots...)
	a.Config.WorkspaceRoots = append([]string(nil), roots...)
}

func (a *App) WorkspaceFiles() ([]document.WorkspaceRoot, error) {
	a.mu.RLock()
	roots := append([]string(nil), a.WorkspaceRoots...)
	a.mu.RUnlock()
	if len(roots) == 0 {
		return nil, nil
	}
	return document.ListWorkspaceRoots(roots)
}
