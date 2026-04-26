package main

import (
	"context"
	"fmt"
	"os"

	"github.com/mintori/home-manager/tools/mdview/internal/app"
	"github.com/mintori/home-manager/tools/mdview/internal/config"
)

func main() {
	runtime := app.Runtime{
		ConfigManager: config.Manager{},
	}

	if err := runtime.Run(context.Background(), os.Args[1:], os.Stdin); err != nil {
		fmt.Fprintf(os.Stderr, "mdview: %v\n", err)
		os.Exit(1)
	}
}
