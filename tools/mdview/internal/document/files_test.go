package document

import (
	"os"
	"path/filepath"
	"testing"
)

func TestListMarkdownFilesReturnsSortedRelativePaths(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	if err := os.Mkdir(filepath.Join(root, "nested"), 0o755); err != nil {
		t.Fatalf("mkdir nested: %v", err)
	}

	fixtures := map[string]string{
		"a.md":            "# a",
		"nested/b.md":     "# b",
		"nested/skip.txt": "nope",
	}

	for name, content := range fixtures {
		path := filepath.Join(root, filepath.FromSlash(name))
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			t.Fatalf("write fixture %s: %v", name, err)
		}
	}

	files, err := ListMarkdownFiles(root)
	if err != nil {
		t.Fatalf("ListMarkdownFiles returned error: %v", err)
	}

	want := []FileEntry{
		{Path: "nested/", Name: "nested", Type: "directory"},
		{Path: "a.md", Name: "a.md", Type: "file"},
		{Path: "nested/b.md", Name: "b.md", Type: "file"},
	}
	if len(files) != len(want) {
		t.Fatalf("expected %d entries, got %d (%v)", len(want), len(files), files)
	}

	for i, item := range want {
		if files[i].Path != item.Path || files[i].Type != item.Type {
			t.Fatalf("expected entry %d to be %+v, got %+v", i, item, files[i])
		}
	}
}
