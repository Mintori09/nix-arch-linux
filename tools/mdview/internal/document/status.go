package document

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"time"
)

type Snapshot struct {
	Content      string
	LastModified time.Time
	ReadOnly     bool
	RevisionID   string
}

func SnapshotFile(path string) (Snapshot, error) {
	info, err := os.Stat(path)
	if err != nil {
		return Snapshot{}, fmt.Errorf("stat document: %w", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return Snapshot{}, fmt.Errorf("read document: %w", err)
	}

	return Snapshot{
		Content:      string(data),
		LastModified: info.ModTime(),
		ReadOnly:     info.Mode().Perm()&0o200 == 0,
		RevisionID:   RevisionID(data),
	}, nil
}

func RevisionID(content []byte) string {
	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:])
}
