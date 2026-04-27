package document

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSnapshotFileIncludesRevisionMetadata(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, "note.md")
	if err := os.WriteFile(path, []byte("# one"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	snapshot, err := SnapshotFile(path)
	if err != nil {
		t.Fatalf("snapshot file: %v", err)
	}

	if snapshot.Content != "# one" {
		t.Fatalf("expected content to be loaded, got %q", snapshot.Content)
	}

	if snapshot.RevisionID == "" {
		t.Fatal("expected revision id to be populated")
	}

	if snapshot.LastModified.IsZero() {
		t.Fatal("expected last modified timestamp to be populated")
	}
}
