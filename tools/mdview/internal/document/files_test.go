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

	want := []string{"a.md", "nested/b.md"}
	if len(files) != len(want) {
		t.Fatalf("expected %d files, got %d (%v)", len(want), len(files), files)
	}

	for i, item := range want {
		if files[i].Path != item {
			t.Fatalf("expected file %d to be %q, got %q", i, item, files[i].Path)
		}
	}
}
