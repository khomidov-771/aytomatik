package main

import (
	"context"
	"fmt"
	"github.com/ids-automate/ids-automate/api/internal/config"
	"github.com/ids-automate/ids-automate/api/internal/migrations"
	"github.com/ids-automate/ids-automate/api/internal/store"
	"log"
)

func main() {
	ctx := context.Background()
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	db, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.DB.Close()
	if err = migrations.Up(ctx, db.DB); err != nil {
		log.Fatal(err)
	}
	fmt.Println("migrations applied")
}
