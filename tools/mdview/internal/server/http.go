package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/mintori/home-manager/tools/mdview/internal/config"
	"github.com/mintori/home-manager/tools/mdview/internal/document"
	"github.com/mintori/home-manager/tools/mdview/internal/session"
)

type Options struct {
	App           *session.App
	Store         document.Store
	ConfigManager config.Manager
	Assets        fs.FS
	TTS           TTSService
}

type Server struct {
	opts Options
	mux  *http.ServeMux
}

func New(opts Options) *Server {
	if opts.TTS == nil && opts.App != nil {
		opts.TTS = NewTTSService(opts.App.Config)
	}
	s := &Server{
		opts: opts,
		mux:  http.NewServeMux(),
	}

	s.routes()
	return s
}

func (s *Server) Handler() http.Handler {
	return s.mux
}

func (s *Server) routes() {
	s.mux.HandleFunc("/api/document", s.handleDocument)
	s.mux.HandleFunc("/api/document/status", s.handleDocumentStatus)
	s.mux.HandleFunc("/api/config", s.handleConfig)
	s.mux.HandleFunc("/api/files", s.handleFiles)
	s.mux.HandleFunc("/api/session/presence", s.handleSessionPresence)
	s.mux.HandleFunc("/api/workspace/roots", s.handleWorkspaceRoots)
	s.mux.HandleFunc("/api/open", s.handleOpen)
	s.mux.HandleFunc("/api/search", s.handleSearch)
	s.mux.HandleFunc("/api/tts", s.handleTTS)
	s.mux.HandleFunc("/api/tts/voices", s.handleTTSVoices)
	s.mux.HandleFunc("/api/asset", s.handleAsset)
	s.mux.HandleFunc("/api/render", s.handleRender)
	s.mux.HandleFunc("/", s.handleIndex)
}

func (s *Server) handleDocument(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		_, doc, _ := s.opts.App.Snapshot()
		writeJSON(w, http.StatusOK, doc)
		return
	case http.MethodPut:
		if !requireToken(s.opts.App.Token, w, r) {
			return
		}

		var payload struct {
			Content        string `json:"content"`
			BaseRevisionID string `json:"base_revision_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "invalid document payload", http.StatusBadRequest)
			return
		}

		doc, err := s.saveDocument(r.Context(), payload.Content, payload.BaseRevisionID)
		if err != nil {
			var conflictErr *documentConflictError
			switch {
			case errors.As(err, &conflictErr):
				writeJSON(w, http.StatusConflict, map[string]any{
					"conflict":      true,
					"path":          conflictErr.Path,
					"content":       conflictErr.Content,
					"revision_id":   conflictErr.RevisionID,
					"last_modified": conflictErr.LastModified,
					"read_only":     conflictErr.ReadOnly,
				})
			case errors.Is(err, errDocumentNotSaveable):
				http.Error(w, err.Error(), http.StatusConflict)
			case errors.Is(err, errDocumentReadOnly):
				http.Error(w, err.Error(), http.StatusForbidden)
			default:
				http.Error(w, fmt.Sprintf("save document: %v", err), http.StatusInternalServerError)
			}
			return
		}

		writeJSON(w, http.StatusOK, doc)
		return
	}

	http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
}

func (s *Server) handleDocumentStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	_, doc, _ := s.opts.App.Snapshot()
	if doc.Temporary || doc.Path == "" {
		writeJSON(w, http.StatusOK, map[string]any{
			"tracked": false,
			"changed": false,
		})
		return
	}

	snapshot, err := document.SnapshotFile(doc.Path)
	if err != nil {
		http.Error(w, fmt.Sprintf("snapshot document: %v", err), http.StatusInternalServerError)
		return
	}

	changed := snapshot.RevisionID != doc.RevisionID
	payload := map[string]any{
		"tracked":       true,
		"changed":       changed,
		"dirty":         doc.Dirty,
		"path":          doc.Path,
		"revision_id":   snapshot.RevisionID,
		"last_modified": snapshot.LastModified,
		"read_only":     snapshot.ReadOnly,
	}
	if changed {
		payload["content"] = snapshot.Content
		payload["name"] = doc.Name
		payload["conflict"] = doc.Dirty
	}

	writeJSON(w, http.StatusOK, payload)
}

func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		cfg, _, _ := s.opts.App.Snapshot()
		writeJSON(w, http.StatusOK, cfg)
	case http.MethodPut:
		if !requireToken(s.opts.App.Token, w, r) {
			return
		}
		var payload config.Config
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "invalid config payload", http.StatusBadRequest)
			return
		}

		current, _, _ := s.opts.App.Snapshot()
		merged := mergeConfig(current, payload)
		if err := s.opts.ConfigManager.Save(r.Context(), merged); err != nil {
			http.Error(w, fmt.Sprintf("save config: %v", err), http.StatusInternalServerError)
			return
		}

		s.opts.App.SetConfig(merged)
		s.opts.TTS = NewTTSService(merged)
		writeJSON(w, http.StatusOK, merged)
	default:
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleFiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	roots, err := s.opts.App.WorkspaceFiles()
	if err != nil {
		http.Error(w, fmt.Sprintf("list files: %v", err), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"roots": roots,
	})
}

func (s *Server) handleSessionPresence(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	if !requireToken(s.opts.App.Token, w, r) {
		return
	}

	var payload struct {
		ClientID string `json:"client_id"`
		State    string `json:"state"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid presence payload", http.StatusBadRequest)
		return
	}

	payload.ClientID = strings.TrimSpace(payload.ClientID)
	payload.State = strings.TrimSpace(payload.State)
	if payload.ClientID == "" {
		http.Error(w, "missing client_id", http.StatusBadRequest)
		return
	}

	if s.opts.App.Presence != nil {
		switch payload.State {
		case "active":
			s.opts.App.Presence.Touch(payload.ClientID)
		case "closing":
			s.opts.App.Presence.CloseClient(payload.ClientID)
		default:
			http.Error(w, "invalid state", http.StatusBadRequest)
			return
		}
	} else if payload.State != "active" && payload.State != "closing" {
		http.Error(w, "invalid state", http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleWorkspaceRoots(w http.ResponseWriter, r *http.Request) {
	if !requireToken(s.opts.App.Token, w, r) {
		return
	}

	var payload struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid workspace root payload", http.StatusBadRequest)
		return
	}

	rootPath := filepath.Clean(strings.TrimSpace(payload.Path))
	if rootPath == "" || rootPath == "." {
		http.Error(w, "missing path", http.StatusBadRequest)
		return
	}

	cfg, _, roots := s.opts.App.Snapshot()
	switch r.Method {
	case http.MethodPost:
		info, err := os.Stat(rootPath)
		if err != nil {
			http.Error(w, fmt.Sprintf("stat workspace root: %v", err), http.StatusBadRequest)
			return
		}
		if !info.IsDir() {
			http.Error(w, "workspace root must be a directory", http.StatusBadRequest)
			return
		}
		if !containsRoot(roots, rootPath) {
			roots = append(roots, rootPath)
		}
	case http.MethodDelete:
		roots = removeRoot(roots, rootPath)
	default:
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	cfg.WorkspaceRoots = roots
	if err := s.opts.ConfigManager.Save(r.Context(), cfg); err != nil {
		http.Error(w, fmt.Sprintf("save workspace roots: %v", err), http.StatusInternalServerError)
		return
	}

	s.opts.App.SetConfig(cfg)
	s.opts.App.SetWorkspaceRoots(roots)

	items, err := s.opts.App.WorkspaceFiles()
	if err != nil {
		http.Error(w, fmt.Sprintf("list workspace files: %v", err), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"roots": items,
	})
}

func (s *Server) handleOpen(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	_, currentDoc, workspaceRoots := s.opts.App.Snapshot()

	relative := strings.TrimSpace(r.URL.Query().Get("path"))
	if relative == "" {
		http.Error(w, "missing path", http.StatusBadRequest)
		return
	}

	baseRoot := strings.TrimSpace(r.URL.Query().Get("root"))
	if baseRoot != "" {
		baseRoot = filepath.Clean(baseRoot)
		if !containsRoot(workspaceRoots, baseRoot) {
			http.Error(w, "unknown workspace root", http.StatusBadRequest)
			return
		}
	} else if currentDoc.Path != "" {
		doc, err := readRelativeFileDocument(currentDoc, relative)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		s.opts.App.SetDocument(doc)
		writeJSON(w, http.StatusOK, doc)
		return
	} else {
		http.Error(w, "folder mode is not active", http.StatusConflict)
		return
	}

	doc, err := readFileDocument(baseRoot, relative)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.opts.App.SetDocument(doc)
	writeJSON(w, http.StatusOK, doc)
}

func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	query := strings.TrimSpace(r.URL.Query().Get("q"))
	scope := strings.TrimSpace(r.URL.Query().Get("scope"))
	_, doc, roots := s.opts.App.Snapshot()
	results := make([]map[string]any, 0)

	if query == "" {
		writeJSON(w, http.StatusOK, map[string]any{"results": results})
		return
	}

	switch scope {
	case "", "file":
		results = append(results, searchInContent(doc.Name, doc.Content, query)...)
	case "workspace":
		for _, root := range roots {
			files, err := document.ListMarkdownFiles(root)
			if err != nil {
				http.Error(w, fmt.Sprintf("search workspace: %v", err), http.StatusInternalServerError)
				return
			}
			for _, file := range files {
				if file.Type != "file" {
					continue
				}
				fullPath := filepath.Join(root, filepath.FromSlash(file.Path))
				data, err := os.ReadFile(fullPath)
				if err != nil {
					continue
				}
				results = append(results, searchInWorkspaceContent(root, file.Path, string(data), query)...)
			}
		}
	default:
		http.Error(w, "invalid search scope", http.StatusBadRequest)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"results": results})
}

func (s *Server) handleAsset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	requested := strings.TrimSpace(r.URL.Query().Get("path"))
	if requested == "" {
		http.NotFound(w, r)
		return
	}

	_, doc, _ := s.opts.App.Snapshot()
	fullPath, err := resolveAssetPath(doc.FolderRoot, doc.Path, requested)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	http.ServeFile(w, r, fullPath)
}

func (s *Server) handleRender(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	var payload struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid render payload", http.StatusBadRequest)
		return
	}

	cfg, _, _ := s.opts.App.Snapshot()
	html := renderMarkdown(payload.Content, cfg.AllowRawHTML)
	writeJSON(w, http.StatusOK, map[string]any{"html": html})
}

var (
	errDocumentNotSaveable = errors.New("document is not file-backed")
	errDocumentReadOnly    = errors.New("document is read-only")
)

type documentConflictError struct {
	Path         string
	Content      string
	RevisionID   string
	LastModified any
	ReadOnly     bool
}

func (e *documentConflictError) Error() string {
	return "document changed on disk"
}

func (s *Server) saveDocument(ctx context.Context, content, baseRevisionID string) (session.Document, error) {
	_, doc, _ := s.opts.App.Snapshot()
	if doc.Temporary || doc.Path == "" {
		return session.Document{}, errDocumentNotSaveable
	}
	if doc.ReadOnly {
		return session.Document{}, errDocumentReadOnly
	}

	snapshot, err := document.SnapshotFile(doc.Path)
	if err != nil {
		return session.Document{}, err
	}

	expectedRevision := strings.TrimSpace(baseRevisionID)
	if expectedRevision == "" {
		expectedRevision = doc.RevisionID
	}
	if expectedRevision != "" && snapshot.RevisionID != expectedRevision {
		return session.Document{}, &documentConflictError{
			Path:         doc.Path,
			Content:      snapshot.Content,
			RevisionID:   snapshot.RevisionID,
			LastModified: snapshot.LastModified,
			ReadOnly:     snapshot.ReadOnly,
		}
	}

	if err := s.opts.Store.SaveAtomic(ctx, doc.Path, []byte(content)); err != nil {
		return session.Document{}, err
	}

	savedSnapshot, err := document.SnapshotFile(doc.Path)
	if err != nil {
		return session.Document{}, err
	}

	savedDoc := doc
	savedDoc.Content = savedSnapshot.Content
	savedDoc.Dirty = false
	savedDoc.ReadOnly = savedSnapshot.ReadOnly
	savedDoc.SavedAt = savedSnapshot.LastModified
	savedDoc.LastModified = savedSnapshot.LastModified
	savedDoc.RevisionID = savedSnapshot.RevisionID
	s.opts.App.SetDocument(savedDoc)
	return savedDoc, nil
}

func (s *Server) handleTTS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	if !requireToken(s.opts.App.Token, w, r) {
		return
	}
	if s.opts.TTS == nil {
		http.Error(w, "tts service is not configured", http.StatusServiceUnavailable)
		return
	}

	var payload struct {
		Text     string  `json:"text"`
		Provider string  `json:"provider"`
		Language string  `json:"language"`
		Voice    string  `json:"voice"`
		Speed    float64 `json:"speed"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid tts payload", http.StatusBadRequest)
		return
	}

	cfg, _, _ := s.opts.App.Snapshot()
	req := SynthesizeRequest{
		Text:     strings.TrimSpace(payload.Text),
		Provider: firstNonEmpty(payload.Provider, cfg.TTSProvider),
		Language: firstNonEmpty(payload.Language, cfg.TTSLanguage),
		Voice:    firstNonEmpty(payload.Voice, cfg.TTSVoice),
		Speed:    payload.Speed,
	}
	if req.Speed == 0 {
		req.Speed = cfg.TTSSpeed
	}
	if req.Text == "" {
		http.Error(w, "tts text is required", http.StatusBadRequest)
		return
	}

	audio, err := s.opts.TTS.Synthesize(r.Context(), req)
	if err != nil {
		http.Error(w, fmt.Sprintf("tts synthesis failed: %v", err), http.StatusBadGateway)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"audio_content":  audio.AudioContentBase64,
		"audio_encoding": audio.AudioEncoding,
		"content_type":   audio.ContentType,
		"voice":          audio.VoiceName,
	})
}

func (s *Server) handleTTSVoices(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	cfg, _, _ := s.opts.App.Snapshot()
	language := strings.TrimSpace(r.URL.Query().Get("language"))
	if language == "" {
		language = cfg.TTSLanguage
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"provider": cfg.TTSProvider,
		"language": language,
		"voices":   googleVoicesForLanguage(language),
	})
}

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	if s.opts.Assets == nil {
		http.Error(w, "frontend assets are not configured", http.StatusServiceUnavailable)
		return
	}

	name := strings.TrimPrefix(r.URL.Path, "/")
	if name == "" {
		name = "index.html"
	}

	data, err := fs.ReadFile(s.opts.Assets, name)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			data, err = fs.ReadFile(s.opts.Assets, "index.html")
		}
		if err != nil {
			http.NotFound(w, r)
			return
		}
	}

	switch filepath.Ext(name) {
	case ".css":
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
	case ".js":
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	default:
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
	}

	_, _ = w.Write(data)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func mergeConfig(current, next config.Config) config.Config {
	merged := current

	if next.Browser != "" {
		merged.Browser = next.Browser
	}
	if next.FallbackBrowser != "" {
		merged.FallbackBrowser = next.FallbackBrowser
	}
	if next.Theme != "" {
		merged.Theme = next.Theme
	}
	if next.Appearance != "" {
		merged.Appearance = next.Appearance
	}
	if next.ContentWidth != 0 {
		merged.ContentWidth = next.ContentWidth
	}
	if next.FontSize != 0 {
		merged.FontSize = next.FontSize
	}
	if next.LineHeight != "" {
		merged.BodyLineHeight = next.LineHeight
	}
	if next.BodyLineHeight != "" {
		merged.BodyLineHeight = next.BodyLineHeight
	}
	if next.ParagraphSpacing != "" {
		merged.ParagraphSpacing = next.ParagraphSpacing
	}
	if next.CodeFontSize != 0 {
		merged.CodeFontSize = next.CodeFontSize
	}
	if next.CodeLineHeight != "" {
		merged.CodeLineHeight = next.CodeLineHeight
	}
	if next.FontFamily != "" {
		merged.FontFamily = next.FontFamily
	}
	if next.CustomCSS != "" {
		merged.CustomCSS = next.CustomCSS
	}
	if next.AssetsDir != "" {
		merged.AssetsDir = next.AssetsDir
	}
	if len(next.WorkspaceRoots) > 0 {
		merged.WorkspaceRoots = append([]string(nil), next.WorkspaceRoots...)
	}
	if next.SpeechLanguage != "" {
		merged.SpeechLanguage = next.SpeechLanguage
	}
	if next.SpeechVoice != "" || merged.SpeechVoice != "" {
		merged.SpeechVoice = next.SpeechVoice
	}
	if next.SpeechRate != 0 {
		merged.SpeechRate = next.SpeechRate
	}
	if next.SpeechAutoNext != nil {
		merged.SpeechAutoNext = next.SpeechAutoNext
	}
	if next.TTSProvider != "" {
		merged.TTSProvider = next.TTSProvider
	}
	if next.TTSLanguage != "" {
		merged.TTSLanguage = next.TTSLanguage
	}
	if next.TTSVoice != "" || merged.TTSVoice != "" {
		merged.TTSVoice = next.TTSVoice
	}
	if next.TTSSpeed != 0 {
		merged.TTSSpeed = next.TTSSpeed
	}
	if next.TTSAutoNext != nil {
		merged.TTSAutoNext = next.TTSAutoNext
	}
	merged.AllowRawHTML = next.AllowRawHTML
	merged.LocalOnly = next.LocalOnly
	return merged
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func readFileDocument(root, relative string) (session.Document, error) {
	cleaned := filepath.Clean(relative)
	if cleaned == "." || strings.HasPrefix(cleaned, "..") {
		return session.Document{}, errors.New("invalid relative path")
	}

	fullPath := filepath.Join(root, cleaned)
	info, err := os.Stat(fullPath)
	if err != nil {
		return session.Document{}, fmt.Errorf("open document: %w", err)
	}
	if info.IsDir() {
		return session.Document{}, errors.New("path must be a markdown file")
	}

	snapshot, err := document.SnapshotFile(fullPath)
	if err != nil {
		return session.Document{}, err
	}

	return session.Document{
		Path:         fullPath,
		Name:         filepath.Base(fullPath),
		Content:      snapshot.Content,
		Temporary:    false,
		ReadOnly:     snapshot.ReadOnly,
		LastModified: snapshot.LastModified,
		RevisionID:   snapshot.RevisionID,
		FolderRoot:   root,
	}, nil
}

func readRelativeFileDocument(currentDoc session.Document, relative string) (session.Document, error) {
	cleaned := filepath.Clean(relative)
	if cleaned == "." || strings.HasPrefix(cleaned, "..") {
		return session.Document{}, errors.New("invalid relative path")
	}

	fullPath := filepath.Join(filepath.Dir(currentDoc.Path), cleaned)
	info, err := os.Stat(fullPath)
	if err != nil {
		return session.Document{}, fmt.Errorf("open document: %w", err)
	}
	if info.IsDir() {
		return session.Document{}, errors.New("path must be a markdown file")
	}

	snapshot, err := document.SnapshotFile(fullPath)
	if err != nil {
		return session.Document{}, err
	}

	return session.Document{
		Path:         fullPath,
		Name:         filepath.Base(fullPath),
		Content:      snapshot.Content,
		Temporary:    false,
		ReadOnly:     snapshot.ReadOnly,
		LastModified: snapshot.LastModified,
		RevisionID:   snapshot.RevisionID,
		FolderRoot:   currentDoc.FolderRoot,
	}, nil
}

func resolveAssetPath(root, currentPath, requested string) (string, error) {
	var baseDir string
	if currentPath != "" {
		baseDir = filepath.Dir(currentPath)
	} else if root != "" {
		baseDir = root
	} else {
		return "", errors.New("asset resolution requires an active file or folder")
	}

	fullPath := filepath.Clean(filepath.Join(baseDir, filepath.FromSlash(requested)))
	if root != "" {
		rel, err := filepath.Rel(root, fullPath)
		if err != nil || strings.HasPrefix(rel, "..") {
			return "", errors.New("asset path escapes root")
		}
	}

	return fullPath, nil
}

func searchInContent(path, content, query string) []map[string]any {
	queryLower := strings.ToLower(query)
	lines := strings.Split(content, "\n")
	results := make([]map[string]any, 0)
	for i, line := range lines {
		if strings.Contains(strings.ToLower(line), queryLower) {
			results = append(results, map[string]any{
				"path":    path,
				"line":    i + 1,
				"excerpt": strings.TrimSpace(line),
			})
		}
	}
	return results
}

func searchInWorkspaceContent(root, path, content, query string) []map[string]any {
	results := searchInContent(path, content, query)
	for _, result := range results {
		result["root"] = root
	}
	return results
}

func containsRoot(roots []string, root string) bool {
	for _, item := range roots {
		if item == root {
			return true
		}
	}
	return false
}

func removeRoot(roots []string, root string) []string {
	filtered := roots[:0]
	for _, item := range roots {
		if item == root {
			continue
		}
		filtered = append(filtered, item)
	}
	return filtered
}

func (s *Server) Shutdown(ctx context.Context) error {
	_ = ctx
	return nil
}
