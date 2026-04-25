package history

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestStoreSaveListDelete(t *testing.T) {
	store := New(filepath.Join(t.TempDir(), "history.json"))

	entry := Entry{
		ID:        "abc123",
		Prompt:    "list files",
		Command:   "ls -la",
		Provider:  "nanogpt",
		Model:     "glm-5",
		Timestamp: time.Unix(1700000000, 0).UTC(),
	}

	if err := store.Save(entry); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	entries, err := store.List()
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(entries) != 1 || entries[0].Command != "ls -la" {
		t.Fatalf("entries = %+v", entries)
	}

	deleted, err := store.Delete("abc123")
	if err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	if !deleted {
		t.Fatal("expected deletion")
	}
}

func TestStoreDeleteByCommand(t *testing.T) {
	store := New(filepath.Join(t.TempDir(), "history.json"))

	entry := Entry{
		ID:        "abc123",
		Prompt:    "list files",
		Command:   "ls -la",
		Provider:  "nanogpt",
		Model:     "glm-5",
		Timestamp: time.Unix(1700000000, 0).UTC(),
	}

	if err := store.Save(entry); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	deleted, err := store.Delete("ls -la")
	if err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	if !deleted {
		t.Fatal("expected deletion by command")
	}
}

func TestStoreDoesNotCrashOnCorruptJSON(t *testing.T) {
	path := filepath.Join(t.TempDir(), "history.json")
	if err := os.WriteFile(path, []byte("{not-json"), 0o600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	store := New(path)
	entries, err := store.List()
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(entries) != 0 {
		t.Fatalf("entries = %+v, want empty", entries)
	}
}
