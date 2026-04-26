package assets

import (
	"embed"
	"io/fs"
)

//go:embed web/*
var raw embed.FS

func FS() fs.FS {
	sub, err := fs.Sub(raw, "web")
	if err != nil {
		panic(err)
	}
	return sub
}
