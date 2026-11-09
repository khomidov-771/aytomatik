package main

import (
	"context"
	"fmt"
	"github.com/ids-automate/ids-automate/api/internal/config"
	"github.com/ids-automate/ids-automate/api/internal/migrations"
	"github.com/ids-automate/ids-automate/api/internal/security"
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
	hash, err := security.HashPassword("Demo1234!")
	if err != nil {
		log.Fatal(err)
	}
	cipher, err := security.NewTokenCipher(cfg.EncryptionKey)
	if err != nil {
		log.Fatal(err)
	}
	token, err := cipher.Encrypt("mock-access-token")
	if err != nil {
		log.Fatal(err)
	}
	if _, err = db.SeedDemo(ctx, hash, token); err != nil {
		log.Fatal(err)
	}
	fmt.Println("demo user: demo@ids.uz / Demo1234!")
}
