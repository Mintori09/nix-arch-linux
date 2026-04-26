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
	"time"

	"github.com/mintori/home-manager/tools/mdview/internal/config"
	"github.com/mintori/home-manager/tools/mdview/internal/document"
	"github.com/mintori/home-manager/tools/mdview/internal/session"
)

type Options struct {
	App           *session.App
	Store         document.Store
	ConfigManager config.Manager
	Assets        fs.FS
}

type Server struct {
	opts Options
	mux  *http.ServeMux
}

func New(opts Options) *Server {
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
	s.mux.HandleFunc("/api/config", s.handleConfig)
	s.mux.HandleFunc("/api/files", s.handleFiles)
	s.mux.HandleFunc("/api/open", s.handleOpen)
	s.mux.HandleFunc("/api/search", s.handleSearch)
	s.mux.HandleFunc("/api/asset", s.handleAsset)
	s.mux.HandleFunc("/api/render", s.handleRender)
	s.mux.HandleFunc("/", s.handleIndex)
}

func (s *Server) handleDocument(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		_, doc, _ := s.opts.App.Snapshot()
		writeJSON(w, http.StatusOK, doc)
	case http.MethodPut:
		if !requireToken(s.opts.App.Token, w, r) {
			return
		}

		var payload struct {
			Content string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "invalid document payload", http.StatusBadRequest)
			return
		}

		_, doc, _ := s.opts.App.Snapshot()
		if doc.Temporary || doc.Path == "" {
			http.Error(w, "temporary document cannot be autosaved", http.StatusConflict)
			return
		}
		if doc.ReadOnly {
			http.Error(w, "document is read-only", http.StatusForbidden)
			return
		}

		if err := s.opts.Store.SaveAtomic(r.Context(), doc.Path, []byte(payload.Content)); err != nil {
			http.Error(w, fmt.Sprintf("save document: %v", err), http.StatusInternalServerError)
			return
		}

		now := time.Now()
		doc.Content = payload.Content
		doc.SavedAt = now
		s.opts.App.SetDocument(doc)
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":       true,
			"saved_at": now,
		})
	default:
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
	}
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

	files, err := s.opts.App.MarkdownFiles()
	if err != nil {
		http.Error(w, fmt.Sprintf("list files: %v", err), http.StatusInternalServerError)
		return
	}

	_, _, root := s.opts.App.Snapshot()
	writeJSON(w, http.StatusOK, map[string]any{
		"root":  root,
		"files": files,
	})
}

func (s *Server) handleOpen(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	_, currentDoc, root := s.opts.App.Snapshot()

	relative := strings.TrimSpace(r.URL.Query().Get("path"))
	if relative == "" {
		http.Error(w, "missing path", http.StatusBadRequest)
		return
	}

	baseRoot := root
	if baseRoot == "" {
		if currentDoc.Path == "" {
			http.Error(w, "folder mode is not active", http.StatusConflict)
			return
		}
		baseRoot = filepath.Dir(currentDoc.Path)
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
	_, doc, root := s.opts.App.Snapshot()
	results := make([]map[string]any, 0)

	if query == "" {
		writeJSON(w, http.StatusOK, map[string]any{"results": results})
		return
	}

	switch scope {
	case "", "file":
		results = append(results, searchInContent(doc.Name, doc.Content, query)...)
	case "workspace":
		files, err := document.ListMarkdownFiles(root)
		if err != nil {
			http.Error(w, fmt.Sprintf("search workspace: %v", err), http.StatusInternalServerError)
			return
		}
		for _, file := range files {
			fullPath := filepath.Join(root, filepath.FromSlash(file.Path))
			data, err := os.ReadFile(fullPath)
			if err != nil {
				continue
			}
			results = append(results, searchInContent(file.Path, string(data), query)...)
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

	_, doc, root := s.opts.App.Snapshot()
	fullPath, err := resolveAssetPath(root, doc.Path, requested)
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

	html := renderMarkdown(payload.Content)
	writeJSON(w, http.StatusOK, map[string]any{"html": html})
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
	if next.AutosaveDebounceMS != 0 {
		merged.AutosaveDebounceMS = next.AutosaveDebounceMS
	}
	merged.AllowRawHTML = next.AllowRawHTML
	merged.LocalOnly = next.LocalOnly
	return merged
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

	data, err := os.ReadFile(fullPath)
	if err != nil {
		return session.Document{}, fmt.Errorf("read document: %w", err)
	}

	readonly := info.Mode().Perm()&0o200 == 0
	return session.Document{
		Path:       fullPath,
		Name:       filepath.Base(fullPath),
		Content:    string(data),
		Temporary:  false,
		ReadOnly:   readonly,
		FolderRoot: root,
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

func (s *Server) Shutdown(ctx context.Context) error {
	_ = ctx
	return nil
}
