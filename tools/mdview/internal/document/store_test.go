package document

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestSaveAtomicWritesContentAndRemovesTempFile(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, "note.md")
	if err := os.WriteFile(path, []byte("old"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	store := Store{}
	if err := store.SaveAtomic(context.Background(), path, []byte("new content")); err != nil {
		t.Fatalf("SaveAtomic returned error: %v", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read file: %v", err)
	}

	if string(data) != "new content" {
		t.Fatalf("expected updated content, got %q", string(data))
	}

	matches, err := filepath.Glob(filepath.Join(dir, ".note.md.*.tmp"))
	if err != nil {
		t.Fatalf("glob temp files: %v", err)
	}

	if len(matches) != 0 {
		t.Fatalf("expected no temp files, found %v", matches)
	}
}
