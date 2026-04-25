package history

import (
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"time"
)

type Entry struct {
	ID        string    `json:"id"`
	Prompt    string    `json:"prompt"`
	Command   string    `json:"command"`
	Provider  string    `json:"provider"`
	Model     string    `json:"model"`
	Timestamp time.Time `json:"timestamp"`
}

type Store struct {
	path string
}

func New(path string) Store {
	return Store{path: path}
}

func (s Store) List() ([]Entry, error) {
	data, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			return []Entry{}, nil
		}
		return nil, err
	}
	if len(data) == 0 {
		return []Entry{}, nil
	}

	var entries []Entry
	if err := json.Unmarshal(data, &entries); err != nil {
		return []Entry{}, nil
	}
	slices.SortFunc(entries, func(a, b Entry) int {
		if a.Timestamp.After(b.Timestamp) {
			return -1
		}
		if a.Timestamp.Before(b.Timestamp) {
			return 1
		}
		return 0
	})
	return entries, nil
}

func (s Store) Save(entry Entry) error {
	entries, err := s.List()
	if err != nil {
		return err
	}
	entries = append(entries, entry)
	return s.write(entries)
}

func (s Store) Delete(id string) (bool, error) {
	entries, err := s.List()
	if err != nil {
		return false, err
	}
	filtered := make([]Entry, 0, len(entries))
	deleted := false
	for _, entry := range entries {
		if entry.ID == id || entry.Command == id {
			deleted = true
			continue
		}
		filtered = append(filtered, entry)
	}
	if !deleted {
		return false, nil
	}
	return true, s.write(filtered)
}

func (s Store) write(entries []Entry) error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(entries, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, data, 0o600)
}
