package app

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/mintori/home-manager/tools/mdview/internal/config"
)

func TestBuildSessionFromFileLoadsDocument(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	filePath := filepath.Join(dir, "note.md")
	if err := os.WriteFile(filePath, []byte("# note"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	appState, err := BuildSession(context.Background(), BuildOptions{
		Input:  Input{Kind: InputFile, Path: filePath},
		Config: config.Default(),
		Token:  "secret",
	})
	if err != nil {
		t.Fatalf("BuildSession returned error: %v", err)
	}

	_, doc, roots := appState.Snapshot()
	if len(roots) != 0 {
		t.Fatalf("expected no workspace roots for single file mode, got %+v", roots)
	}

	if doc.Path != filePath || doc.Content != "# note" {
		t.Fatalf("unexpected document: %+v", doc)
	}
}

func TestBuildSessionFromFolderSelectsFirstMarkdownFile(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "b.md"), []byte("# b"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, "a.md"), []byte("# a"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	appState, err := BuildSession(context.Background(), BuildOptions{
		Input:  Input{Kind: InputFolder, Path: root},
		Config: config.Default(),
		Token:  "secret",
	})
	if err != nil {
		t.Fatalf("BuildSession returned error: %v", err)
	}

	_, doc, roots := appState.Snapshot()
	if len(roots) != 1 || roots[0] != root {
		t.Fatalf("expected workspace root %q, got %+v", root, roots)
	}

	if doc.Name != "a.md" {
		t.Fatalf("expected first markdown file a.md, got %q", doc.Name)
	}
}

func TestBuildSessionFromClipboardCreatesTemporaryDocument(t *testing.T) {
	t.Parallel()

	appState, err := BuildSession(context.Background(), BuildOptions{
		Input:  Input{Kind: InputClipboard, Content: "# clip"},
		Config: config.Default(),
		Token:  "secret",
	})
	if err != nil {
		t.Fatalf("BuildSession returned error: %v", err)
	}

	_, doc, _ := appState.Snapshot()
	if !doc.Temporary {
		t.Fatal("expected temporary document")
	}

	if doc.Content != "# clip" {
		t.Fatalf("expected clipboard content, got %q", doc.Content)
	}
}

func TestBuildSessionUsesConfiguredWorkspaceRootsWhenNoInputIsProvided(t *testing.T) {
	t.Parallel()

	rootA := t.TempDir()
	rootB := t.TempDir()
	if err := os.WriteFile(filepath.Join(rootA, "z.md"), []byte("# z"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}
	if err := os.WriteFile(filepath.Join(rootB, "a.md"), []byte("# a"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	cfg := config.Default()
	cfg.WorkspaceRoots = []string{rootA, rootB}

	appState, err := BuildSession(context.Background(), BuildOptions{
		Input:  Input{},
		Config: cfg,
		Token:  "secret",
	})
	if err != nil {
		t.Fatalf("BuildSession returned error: %v", err)
	}

	_, doc, roots := appState.Snapshot()
	if len(roots) != 2 || roots[0] != rootA || roots[1] != rootB {
		t.Fatalf("expected configured workspace roots, got %+v", roots)
	}

	if doc.Name != "z.md" {
		t.Fatalf("expected first workspace markdown z.md, got %q", doc.Name)
	}
}
