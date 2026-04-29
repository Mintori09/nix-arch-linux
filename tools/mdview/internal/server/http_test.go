package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/mintori/home-manager/tools/mdview/internal/config"
	"github.com/mintori/home-manager/tools/mdview/internal/document"
	"github.com/mintori/home-manager/tools/mdview/internal/session"
	"github.com/mintori/home-manager/tools/mdview/internal/share"
)

type stubTTSService struct {
	lastRequest SynthesizeRequest
	response    SynthesizeResponse
	err         error
}

func (s *stubTTSService) Synthesize(_ context.Context, req SynthesizeRequest) (SynthesizeResponse, error) {
	s.lastRequest = req
	if s.err != nil {
		return SynthesizeResponse{}, s.err
	}
	return s.response, nil
}

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

func TestDocumentEndpointSavesUpdatedContent(t *testing.T) {
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

	body := bytes.NewBufferString(`{"content":"# updated","base_revision_id":""}`)
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
		t.Fatalf("expected file content to be updated, got %q", string(data))
	}
}

func TestDocumentEndpointRejectsSaveWhenFileChangedOnDisk(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	filePath := filepath.Join(dir, "note.md")
	if err := os.WriteFile(filePath, []byte("# old"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	doc, err := readFileDocument(dir, "note.md")
	if err != nil {
		t.Fatalf("read file document: %v", err)
	}

	if err := os.WriteFile(filePath, []byte("# remote"), 0o644); err != nil {
		t.Fatalf("mutate fixture: %v", err)
	}

	app := &session.App{
		Token:    "secret",
		Config:   config.Default(),
		Document: doc,
	}

	server := New(Options{
		App:   app,
		Store: document.Store{},
	})

	body := bytes.NewBufferString(`{"content":"# local edit"}`)
	req := httptest.NewRequest(http.MethodPut, "/api/document", body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-MDView-Token", "secret")
	rec := httptest.NewRecorder()

	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected status 409, got %d with body %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Conflict   bool   `json:"conflict"`
		Content    string `json:"content"`
		RevisionID string `json:"revision_id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode conflict payload: %v", err)
	}

	if !payload.Conflict {
		t.Fatal("expected conflict payload")
	}

	if payload.Content != "# remote" {
		t.Fatalf("expected remote content in conflict payload, got %q", payload.Content)
	}

	if payload.RevisionID == "" {
		t.Fatal("expected conflict payload to include revision id")
	}
}

func TestFilesEndpointReturnsMarkdownFiles(t *testing.T) {
	t.Parallel()

	rootA := t.TempDir()
	rootB := t.TempDir()
	if err := os.MkdirAll(filepath.Join(rootA, "docs"), 0o755); err != nil {
		t.Fatalf("mkdir docs: %v", err)
	}
	if err := os.WriteFile(filepath.Join(rootA, "docs", "a.md"), []byte("# a"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(rootB, "nested"), 0o755); err != nil {
		t.Fatalf("mkdir nested: %v", err)
	}
	if err := os.WriteFile(filepath.Join(rootB, "nested", "b.md"), []byte("# b"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	app := &session.App{
		Config:         config.Default(),
		WorkspaceRoots: []string{rootA, rootB},
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
		Roots []struct {
			Path    string               `json:"path"`
			Name    string               `json:"name"`
			Entries []document.FileEntry `json:"entries"`
		} `json:"roots"`
	}

	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}

	if len(payload.Roots) != 2 {
		t.Fatalf("expected 2 roots, got %+v", payload.Roots)
	}

	if payload.Roots[0].Path != rootA || payload.Roots[1].Path != rootB {
		t.Fatalf("unexpected roots payload: %+v", payload.Roots)
	}

	if len(payload.Roots[0].Entries) != 2 {
		t.Fatalf("expected rootA entries to include folder and file, got %+v", payload.Roots[0].Entries)
	}

	if payload.Roots[0].Entries[0].Type != "directory" || payload.Roots[0].Entries[1].Type != "file" {
		t.Fatalf("expected directory before file for rootA, got %+v", payload.Roots[0].Entries)
	}
}

func TestShareEndpointsRequireToken(t *testing.T) {
	t.Parallel()

	app := &session.App{
		Token:  "secret",
		Config: config.Default(),
		Document: session.Document{
			Name:      "note.md",
			Content:   "# shared",
			Temporary: true,
		},
	}

	server := New(Options{
		App:   app,
		Store: document.Store{},
		Share: &stubShareService{},
	})

	for _, tc := range []struct {
		method string
		path   string
	}{
		{method: http.MethodGet, path: "/api/share"},
		{method: http.MethodPost, path: "/api/share/start"},
		{method: http.MethodPost, path: "/api/share/stop"},
	} {
		req := httptest.NewRequest(tc.method, tc.path, nil)
		rec := httptest.NewRecorder()

		server.Handler().ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("%s %s expected 401, got %d", tc.method, tc.path, rec.Code)
		}
	}
}

func TestShareStartDetachesFromRequestContext(t *testing.T) {
	t.Parallel()

	shareService := &stubShareService{
		state: share.State{
			Status:    share.StatusActive,
			PublicURL: "https://demo.trycloudflare.com/s/share-123",
			ShareID:   "share-123",
		},
	}
	app := &session.App{
		Token:  "secret",
		Config: config.Default(),
		Document: session.Document{
			Name:    "note.md",
			Content: "# shared",
		},
	}
	server := New(Options{
		App:   app,
		Store: document.Store{},
		Share: shareService,
	})

	requestCtx, cancel := context.WithCancel(context.Background())
	req := httptest.NewRequest(http.MethodPost, "/api/share/start?token=secret", nil).WithContext(requestCtx)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d with body %s", rec.Code, rec.Body.String())
	}
	if shareService.startContext == nil {
		t.Fatal("expected share start context to be captured")
	}

	cancel()
	time.Sleep(20 * time.Millisecond)
	if err := shareService.startContext.Err(); err != nil {
		t.Fatalf("expected detached context to remain active after request, got %v", err)
	}
}

func TestShareBootstrapReturnsFrozenDocumentAndSanitizedConfig(t *testing.T) {
	t.Parallel()

	app := &session.App{
		Token:  "secret",
		Config: config.Default(),
	}
	shareState := share.State{
		Status:    share.StatusActive,
		PublicURL: "https://demo.trycloudflare.com/s/share-123",
		ShareID:   "share-123",
		SharedDocument: session.Document{
			Name:      "note.md",
			Content:   "# frozen",
			Temporary: true,
		},
		SharedConfig: config.Config{
			Theme:            "paper",
			Appearance:       "dark",
			ContentWidth:     900,
			FontSize:         19,
			BodyLineHeight:   "1.9",
			ParagraphSpacing: "1.1",
			CodeFontSize:     15,
			CodeLineHeight:   "1.7",
			FontFamily:       "sans-serif",
			CustomCSS:        "should-not-leak",
			WorkspaceRoots:   []string{"/secret"},
		},
	}

	server := New(Options{
		App:   app,
		Store: document.Store{},
		Share: &stubShareService{state: shareState},
	})

	req := httptest.NewRequest(http.MethodGet, "/api/share/public/share-123/bootstrap", nil)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d with body %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Mode     string           `json:"mode"`
		Document session.Document `json:"document"`
		Config   map[string]any   `json:"config"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}

	if payload.Mode != "public-share" {
		t.Fatalf("expected public-share mode, got %q", payload.Mode)
	}
	if payload.Document.Name != "note.md" || payload.Document.Content != "# frozen" {
		t.Fatalf("unexpected document payload: %+v", payload.Document)
	}
	if payload.Config["theme"] != "paper" {
		t.Fatalf("expected theme to be included, got %+v", payload.Config)
	}
	if _, ok := payload.Config["custom_css"]; ok {
		t.Fatalf("expected custom_css to be omitted, got %+v", payload.Config)
	}
	if _, ok := payload.Config["workspace_roots"]; ok {
		t.Fatalf("expected workspace_roots to be omitted, got %+v", payload.Config)
	}
}

func TestShareBootstrapReturnsGoneForExpiredShare(t *testing.T) {
	t.Parallel()

	app := &session.App{
		Config: config.Default(),
	}

	server := New(Options{
		App:   app,
		Store: document.Store{},
		Share: &stubShareService{
			state: share.State{
				Status:  share.StatusIdle,
				ShareID: "share-123",
			},
		},
	})

	req := httptest.NewRequest(http.MethodGet, "/api/share/public/share-123/bootstrap", nil)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusGone {
		t.Fatalf("expected 410, got %d", rec.Code)
	}
}

func TestFaviconAssetServesSVGContentType(t *testing.T) {
	t.Parallel()

	server := New(Options{
		App:    &session.App{Config: config.Default()},
		Store:  document.Store{},
		Assets: testAssetFS(),
	})

	req := httptest.NewRequest(http.MethodGet, "/favicon.svg", nil)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d with body %s", rec.Code, rec.Body.String())
	}

	contentType := rec.Header().Get("Content-Type")
	if contentType != "image/svg+xml" {
		t.Fatalf("expected image/svg+xml content type, got %q", contentType)
	}
}

func TestIndexFallbackServesHTMLContentTypeForUnknownRoute(t *testing.T) {
	t.Parallel()

	server := New(Options{
		App:    &session.App{Config: config.Default()},
		Store:  document.Store{},
		Assets: testAssetFS(),
	})

	req := httptest.NewRequest(http.MethodGet, "/missing-route.js", nil)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d with body %s", rec.Code, rec.Body.String())
	}

	contentType := rec.Header().Get("Content-Type")
	if contentType != "text/html; charset=utf-8" {
		t.Fatalf("expected HTML content type for SPA fallback, got %q", contentType)
	}

	assets, err := fs.ReadFile(testAssetFS(), "index.html")
	if err != nil {
		t.Fatalf("read index asset: %v", err)
	}
	if rec.Body.String() != string(assets) {
		t.Fatal("expected fallback response to serve index.html")
	}
}

func TestWorkspaceAndDocumentAPIsRequireTokenWhenProtectionEnabled(t *testing.T) {
	t.Parallel()

	app := &session.App{
		Token:  "secret",
		Config: config.Default(),
		Document: session.Document{
			Name:      "note.md",
			Content:   "# note",
			Temporary: true,
		},
	}
	server := New(Options{
		App:   app,
		Store: document.Store{},
	})

	for _, tc := range []struct {
		method string
		path   string
	}{
		{method: http.MethodGet, path: "/api/document"},
		{method: http.MethodGet, path: "/api/config"},
		{method: http.MethodGet, path: "/api/files"},
		{method: http.MethodGet, path: "/api/search?q=note"},
	} {
		req := httptest.NewRequest(tc.method, tc.path, nil)
		rec := httptest.NewRecorder()
		server.Handler().ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("%s %s expected 401, got %d", tc.method, tc.path, rec.Code)
		}
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

func TestOpenEndpointResolvesPathWithinRequestedWorkspaceRoot(t *testing.T) {
	t.Parallel()

	rootA := t.TempDir()
	rootB := t.TempDir()
	pathA := filepath.Join(rootA, "shared.md")
	pathB := filepath.Join(rootB, "shared.md")
	if err := os.WriteFile(pathA, []byte("# a"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}
	if err := os.WriteFile(pathB, []byte("# b"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	app := &session.App{
		Config:         config.Default(),
		WorkspaceRoots: []string{rootA, rootB},
	}

	server := New(Options{
		App:   app,
		Store: document.Store{},
	})

	req := httptest.NewRequest(
		http.MethodGet,
		"/api/open?root="+url.QueryEscape(rootB)+"&path=shared.md",
		nil,
	)
	rec := httptest.NewRecorder()

	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d with body %s", rec.Code, rec.Body.String())
	}

	var payload session.Document
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}

	if payload.Path != pathB {
		t.Fatalf("expected rootB path %q, got %q", pathB, payload.Path)
	}
}

func TestWorkspaceRootsEndpointUpdatesSessionAndConfig(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	rootA := t.TempDir()
	rootB := t.TempDir()
	manager := config.Manager{ConfigDir: dir}
	cfg := config.Default()
	cfg.WorkspaceRoots = []string{rootA}
	app := &session.App{
		Token:          "secret",
		Config:         cfg,
		WorkspaceRoots: []string{rootA},
	}

	server := New(Options{
		App:           app,
		Store:         document.Store{},
		ConfigManager: manager,
	})

	addBody := bytes.NewBufferString(`{"path":"` + rootB + `"}`)
	addReq := httptest.NewRequest(http.MethodPost, "/api/workspace/roots", addBody)
	addReq.Header.Set("Content-Type", "application/json")
	addReq.Header.Set("X-MDView-Token", "secret")
	addRec := httptest.NewRecorder()
	server.Handler().ServeHTTP(addRec, addReq)
	if addRec.Code != http.StatusOK {
		t.Fatalf("expected add status 200, got %d with body %s", addRec.Code, addRec.Body.String())
	}

	_, _, roots := app.Snapshot()
	if len(roots) != 2 || roots[1] != rootB {
		t.Fatalf("expected workspace roots to include %q, got %+v", rootB, roots)
	}

	deleteBody := bytes.NewBufferString(`{"path":"` + rootA + `"}`)
	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/workspace/roots", deleteBody)
	deleteReq.Header.Set("Content-Type", "application/json")
	deleteReq.Header.Set("X-MDView-Token", "secret")
	deleteRec := httptest.NewRecorder()
	server.Handler().ServeHTTP(deleteRec, deleteReq)
	if deleteRec.Code != http.StatusOK {
		t.Fatalf("expected delete status 200, got %d with body %s", deleteRec.Code, deleteRec.Body.String())
	}

	loaded, err := manager.Load(context.Background())
	if err != nil {
		t.Fatalf("load config: %v", err)
	}

	if len(loaded.WorkspaceRoots) != 1 || loaded.WorkspaceRoots[0] != rootB {
		t.Fatalf("expected persisted workspace roots to contain only %q, got %+v", rootB, loaded.WorkspaceRoots)
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

	body := bytes.NewBufferString(`{"theme":"paper","content_width":820,"speech_language":"en-US","speech_voice":"Narrator","speech_rate":1.3,"speech_auto_next":false,"tts_provider":"google","tts_language":"vi-VN","tts_voice":"vi-VN-Wavenet-B","tts_speed":0.9,"tts_auto_next":false}`)
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

	if loaded.SpeechLanguage != "en-US" || loaded.SpeechVoice != "Narrator" || loaded.SpeechRate != 1.3 {
		t.Fatalf("expected persisted speech config update, got %+v", loaded)
	}

	if loaded.SpeechAutoNext == nil || *loaded.SpeechAutoNext {
		t.Fatalf("expected speech auto next false, got %+v", loaded.SpeechAutoNext)
	}

	if loaded.TTSProvider != "google" || loaded.TTSLanguage != "vi-VN" || loaded.TTSVoice != "vi-VN-Wavenet-B" || loaded.TTSSpeed != 0.9 {
		t.Fatalf("expected persisted TTS config update, got %+v", loaded)
	}

	if loaded.TTSAutoNext == nil || *loaded.TTSAutoNext {
		t.Fatalf("expected TTS auto next false, got %+v", loaded.TTSAutoNext)
	}
}

func TestSessionPresenceEndpointRequiresToken(t *testing.T) {
	t.Parallel()

	monitor := session.NewPresenceMonitor(session.PresenceOptions{
		IdleGrace:     time.Second,
		StaleAfter:    time.Minute,
		PruneInterval: time.Hour,
	})
	defer monitor.Close()

	server := New(Options{
		App: &session.App{
			Token:    "secret",
			Config:   config.Default(),
			Presence: monitor,
		},
		Store: document.Store{},
	})

	req := httptest.NewRequest(http.MethodPost, "/api/session/presence", strings.NewReader(`{"client_id":"tab-1","state":"active"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", rec.Code)
	}
}

func TestSessionPresenceEndpointRejectsInvalidPayload(t *testing.T) {
	t.Parallel()

	monitor := session.NewPresenceMonitor(session.PresenceOptions{
		IdleGrace:     time.Second,
		StaleAfter:    time.Minute,
		PruneInterval: time.Hour,
	})
	defer monitor.Close()

	server := New(Options{
		App: &session.App{
			Token:    "secret",
			Config:   config.Default(),
			Presence: monitor,
		},
		Store: document.Store{},
	})

	for _, body := range []string{
		`{"client_id":"","state":"active"}`,
		`{"client_id":"tab-1","state":"idle"}`,
	} {
		req := httptest.NewRequest(http.MethodPost, "/api/session/presence", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-MDView-Token", "secret")
		rec := httptest.NewRecorder()

		server.Handler().ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected status 400 for payload %s, got %d", body, rec.Code)
		}
	}
}

func TestSessionPresenceEndpointActiveIsIdempotent(t *testing.T) {
	t.Parallel()

	monitor := session.NewPresenceMonitor(session.PresenceOptions{
		IdleGrace:     time.Second,
		StaleAfter:    time.Minute,
		PruneInterval: time.Hour,
	})
	defer monitor.Close()

	server := New(Options{
		App: &session.App{
			Token:    "secret",
			Config:   config.Default(),
			Presence: monitor,
		},
		Store: document.Store{},
	})

	for range 2 {
		req := httptest.NewRequest(http.MethodPost, "/api/session/presence", strings.NewReader(`{"client_id":"tab-1","state":"active"}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-MDView-Token", "secret")
		rec := httptest.NewRecorder()

		server.Handler().ServeHTTP(rec, req)
		if rec.Code != http.StatusNoContent {
			t.Fatalf("expected status 204, got %d", rec.Code)
		}
	}

	if got := monitor.ActiveClientCount(); got != 1 {
		t.Fatalf("expected 1 active client after repeated active calls, got %d", got)
	}
}

func TestSessionPresenceEndpointClosingOneClientKeepsOthersActive(t *testing.T) {
	t.Parallel()

	monitor := session.NewPresenceMonitor(session.PresenceOptions{
		IdleGrace:     time.Second,
		StaleAfter:    time.Minute,
		PruneInterval: time.Hour,
	})
	defer monitor.Close()

	server := New(Options{
		App: &session.App{
			Token:    "secret",
			Config:   config.Default(),
			Presence: monitor,
		},
		Store: document.Store{},
	})

	for _, body := range []string{
		`{"client_id":"tab-1","state":"active"}`,
		`{"client_id":"tab-2","state":"active"}`,
		`{"client_id":"tab-1","state":"closing"}`,
	} {
		req := httptest.NewRequest(http.MethodPost, "/api/session/presence", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-MDView-Token", "secret")
		rec := httptest.NewRecorder()

		server.Handler().ServeHTTP(rec, req)
		if rec.Code != http.StatusNoContent {
			t.Fatalf("expected status 204, got %d", rec.Code)
		}
	}

	if got := monitor.ActiveClientCount(); got != 1 {
		t.Fatalf("expected one remaining active client, got %d", got)
	}
}

func TestTTSEndpointSynthesizesAudio(t *testing.T) {
	t.Parallel()

	tts := &stubTTSService{
		response: SynthesizeResponse{
			AudioContentBase64: "ZmFrZQ==",
			AudioEncoding:      "MP3",
			ContentType:        "audio/mpeg",
			VoiceName:          "vi-VN-Wavenet-A",
		},
	}

	app := &session.App{
		Token:  "secret",
		Config: config.Default(),
	}

	server := New(Options{
		App:   app,
		Store: document.Store{},
		TTS:   tts,
	})

	body := bytes.NewBufferString(`{"text":"Xin chao","language":"vi-VN","voice":"vi-VN-Wavenet-A","speed":1.1}`)
	req := httptest.NewRequest(http.MethodPost, "/api/tts", body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-MDView-Token", "secret")
	rec := httptest.NewRecorder()

	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d with body %s", rec.Code, rec.Body.String())
	}

	if tts.lastRequest.Text != "Xin chao" || tts.lastRequest.Language != "vi-VN" || tts.lastRequest.Voice != "vi-VN-Wavenet-A" || tts.lastRequest.Speed != 1.1 {
		t.Fatalf("unexpected TTS request: %+v", tts.lastRequest)
	}

	var payload struct {
		AudioContent string `json:"audio_content"`
		ContentType  string `json:"content_type"`
		Voice        string `json:"voice"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}

	if payload.AudioContent != "ZmFrZQ==" || payload.ContentType != "audio/mpeg" || payload.Voice != "vi-VN-Wavenet-A" {
		t.Fatalf("unexpected TTS payload: %+v", payload)
	}
}

func TestTTSEndpointReturnsBadGatewayOnProviderFailure(t *testing.T) {
	t.Parallel()

	app := &session.App{
		Token:  "secret",
		Config: config.Default(),
	}

	server := New(Options{
		App:   app,
		Store: document.Store{},
		TTS:   &stubTTSService{err: errors.New("provider down")},
	})

	body := bytes.NewBufferString(`{"text":"Xin chao","language":"vi-VN","voice":"vi-VN-Wavenet-A","speed":1.0}`)
	req := httptest.NewRequest(http.MethodPost, "/api/tts", body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-MDView-Token", "secret")
	rec := httptest.NewRecorder()

	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("expected status 502, got %d with body %s", rec.Code, rec.Body.String())
	}
}

func TestDocumentStatusEndpointReportsExternalChanges(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	filePath := filepath.Join(dir, "note.md")
	if err := os.WriteFile(filePath, []byte("# old"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	doc, err := readFileDocument(dir, "note.md")
	if err != nil {
		t.Fatalf("read file document: %v", err)
	}

	app := &session.App{
		Config:   config.Default(),
		Document: doc,
	}

	server := New(Options{
		App:   app,
		Store: document.Store{},
	})

	req := httptest.NewRequest(http.MethodGet, "/api/document/status", nil)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var unchanged struct {
		Tracked bool `json:"tracked"`
		Changed bool `json:"changed"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &unchanged); err != nil {
		t.Fatalf("decode unchanged payload: %v", err)
	}

	if !unchanged.Tracked {
		t.Fatal("expected file-backed document to be tracked")
	}

	if unchanged.Changed {
		t.Fatal("expected document to be unchanged")
	}

	if err := os.WriteFile(filePath, []byte("# updated"), 0o644); err != nil {
		t.Fatalf("update file: %v", err)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/document/status", nil)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200 after external change, got %d", rec.Code)
	}

	var changed struct {
		Tracked    bool   `json:"tracked"`
		Changed    bool   `json:"changed"`
		Content    string `json:"content"`
		RevisionID string `json:"revision_id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &changed); err != nil {
		t.Fatalf("decode changed payload: %v", err)
	}

	if !changed.Changed {
		t.Fatal("expected document change to be reported")
	}

	if changed.Content != "# updated" {
		t.Fatalf("expected changed content, got %q", changed.Content)
	}

	if changed.RevisionID == "" {
		t.Fatal("expected changed payload to include revision id")
	}
}

func TestDocumentStatusEndpointReportsConflictForDirtyDocument(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	filePath := filepath.Join(dir, "note.md")
	if err := os.WriteFile(filePath, []byte("# old"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	doc, err := readFileDocument(dir, "note.md")
	if err != nil {
		t.Fatalf("read file document: %v", err)
	}
	doc.Content = "# local draft"
	doc.Dirty = true

	app := &session.App{
		Config:   config.Default(),
		Document: doc,
	}

	server := New(Options{
		App:   app,
		Store: document.Store{},
	})

	if err := os.WriteFile(filePath, []byte("# updated"), 0o644); err != nil {
		t.Fatalf("update file: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/document/status", nil)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var payload struct {
		Changed    bool   `json:"changed"`
		Conflict   bool   `json:"conflict"`
		Dirty      bool   `json:"dirty"`
		Content    string `json:"content"`
		RevisionID string `json:"revision_id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}

	if !payload.Changed || !payload.Conflict || !payload.Dirty {
		t.Fatalf("expected changed+conflict+dirty payload, got %+v", payload)
	}

	if payload.Content != "# updated" {
		t.Fatalf("expected remote content, got %q", payload.Content)
	}

	if payload.RevisionID == "" {
		t.Fatal("expected revision id in payload")
	}
}

func TestDocumentStatusEndpointIgnoresTemporaryDocuments(t *testing.T) {
	t.Parallel()

	app := &session.App{
		Config: config.Default(),
		Document: session.Document{
			Name:      "scratch.md",
			Content:   "# temp",
			Temporary: true,
		},
	}

	server := New(Options{
		App:   app,
		Store: document.Store{},
	})

	req := httptest.NewRequest(http.MethodGet, "/api/document/status", nil)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var payload struct {
		Tracked bool `json:"tracked"`
		Changed bool `json:"changed"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}

	if payload.Tracked {
		t.Fatal("expected temporary document to be untracked")
	}

	if payload.Changed {
		t.Fatal("expected temporary document to report unchanged")
	}
}

type stubShareService struct {
	state        share.State
	startErr     error
	stopErr      error
	startContext context.Context
}

func (s *stubShareService) Start(ctx context.Context, _ string, _ session.Document, _ config.Config) (share.State, error) {
	s.startContext = ctx
	if s.startErr != nil {
		return share.State{}, s.startErr
	}
	return s.state, nil
}

func (s *stubShareService) Stop() error {
	return s.stopErr
}

func (s *stubShareService) Snapshot() share.State {
	return s.state
}

func (s *stubShareService) Close() error {
	return nil
}

func testAssetFS() fs.FS {
	return os.DirFS(filepath.Join("..", "assets", "web"))
}
