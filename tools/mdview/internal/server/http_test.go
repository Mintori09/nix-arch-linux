package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/mintori/home-manager/tools/mdview/internal/config"
	"github.com/mintori/home-manager/tools/mdview/internal/document"
	"github.com/mintori/home-manager/tools/mdview/internal/session"
)

func TestDocumentEndpointReturnsCurrentDocument(t *testing.T) {
	t.Parallel()

	app := &session.App{
		Config: config.Default(),
		Document: session.Document{
			Name:      "scratch.md",
			Content:   "# hello",
			Temporary: true,
		},
	}

	server := New(Options{
		App:   app,
		Store: document.Store{},
	})

	req := httptest.NewRequest(http.MethodGet, "/api/document", nil)
	rec := httptest.NewRecorder()

	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var payload session.Document
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}

	if payload.Name != "scratch.md" {
		t.Fatalf("expected document name scratch.md, got %q", payload.Name)
	}

	if !payload.Temporary {
		t.Fatal("expected temporary document")
	}
}

func TestSaveDocumentEndpointPersistsFileBackedDocument(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	filePath := filepath.Join(dir, "note.md")
	if err := os.WriteFile(filePath, []byte("# old"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	app := &session.App{
		Token:  "secret",
		Config: config.Default(),
		Document: session.Document{
			Path: filePath,
			Name: "note.md",
		},
	}

	server := New(Options{
		App:   app,
		Store: document.Store{},
	})

	body := bytes.NewBufferString(`{"content":"# updated"}`)
	req := httptest.NewRequest(http.MethodPut, "/api/document", body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-MDView-Token", "secret")
	rec := httptest.NewRecorder()

	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d with body %s", rec.Code, rec.Body.String())
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("read file: %v", err)
	}

	if string(data) != "# updated" {
		t.Fatalf("expected updated file content, got %q", string(data))
	}
}

func TestFilesEndpointReturnsMarkdownFiles(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "a.md"), []byte("# a"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	app := &session.App{
		Config: config.Default(),
		Root:   root,
	}

	server := New(Options{
		App:   app,
		Store: document.Store{},
	})

	req := httptest.NewRequest(http.MethodGet, "/api/files", nil)
	rec := httptest.NewRecorder()

	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var payload struct {
		Root  string               `json:"root"`
		Files []document.FileEntry `json:"files"`
	}

	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}

	if payload.Root != root {
		t.Fatalf("expected root %q, got %q", root, payload.Root)
	}

	if len(payload.Files) != 1 || payload.Files[0].Path != "a.md" {
		t.Fatalf("expected one markdown file, got %+v", payload.Files)
	}
}

func TestOpenEndpointResolvesRelativeMarkdownLinkFromCurrentFile(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	currentPath := filepath.Join(root, "current.md")
	targetPath := filepath.Join(root, "next.md")
	if err := os.WriteFile(currentPath, []byte("[next](next.md)"), 0o644); err != nil {
		t.Fatalf("write current fixture: %v", err)
	}
	if err := os.WriteFile(targetPath, []byte("# next"), 0o644); err != nil {
		t.Fatalf("write target fixture: %v", err)
	}

	app := &session.App{
		Config: config.Default(),
		Document: session.Document{
			Path: currentPath,
			Name: "current.md",
		},
	}

	server := New(Options{
		App:   app,
		Store: document.Store{},
	})

	req := httptest.NewRequest(http.MethodGet, "/api/open?path=next.md", nil)
	rec := httptest.NewRecorder()

	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d with body %s", rec.Code, rec.Body.String())
	}

	var payload session.Document
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}

	if payload.Path != targetPath {
		t.Fatalf("expected target path %q, got %q", targetPath, payload.Path)
	}
}

func TestConfigEndpointUpdatesSettings(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	manager := config.Manager{ConfigDir: dir}
	app := &session.App{
		Token:  "secret",
		Config: config.Default(),
	}

	server := New(Options{
		App:           app,
		Store:         document.Store{},
		ConfigManager: manager,
	})

	body := bytes.NewBufferString(`{"theme":"paper","content_width":820}`)
	req := httptest.NewRequest(http.MethodPut, "/api/config", body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-MDView-Token", "secret")
	rec := httptest.NewRecorder()

	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d with body %s", rec.Code, rec.Body.String())
	}

	loaded, err := manager.Load(context.Background())
	if err != nil {
		t.Fatalf("load config: %v", err)
	}

	if loaded.Theme != "paper" || loaded.ContentWidth != 820 {
		t.Fatalf("expected persisted config update, got %+v", loaded)
	}
}
