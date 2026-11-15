//go:build integration

// Package testdb provisions a disposable schema for integration test packages.
package testdb

import (
	"context"
	"fmt"
	postgres "github.com/fergusstrange/embedded-postgres/v2"
	"github.com/fergusstrange/embedded-postgres/v2/eptest"
	"github.com/ids-automate/ids-automate/api/internal/migrations"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func Open(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("IDS_TEST_DATABASE_URL")
	if dsn == "" {
		cacheDir := os.Getenv("IDS_EMBEDDED_POSTGRES_CACHE")
		if cacheDir == "" {
			cacheDir = filepath.Join(os.TempDir(), "ids-embedded-postgres-cache")
		}
		workDir := os.Getenv("IDS_EMBEDDED_POSTGRES_WORK_DIR")
		if workDir == "" {
			workDir = t.TempDir()
		}
		config := postgres.DefaultConfig().Port(0).Database("ids_test").StartTimeout(10 * time.Minute).Storage(postgres.Storage{
			CacheDir: cacheDir,
			WorkDir:  workDir,
		}).Provider(postgres.DownloadProvider{CacheDir: cacheDir, Client: &http.Client{Timeout: 10 * time.Minute}})
		dsn = eptest.Start(t, config).ConnectionURL()
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	// Install shared extensions in public before parallel test packages create
	// their schemas. Neither extension belongs to a disposable test schema.
	tx, err := admin.Begin(ctx)
	if err != nil {
		admin.Close()
		t.Fatal(err)
	}
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(704351934); CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public; CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public"); err != nil {
		_ = tx.Rollback(ctx)
		admin.Close()
		t.Fatal(err)
	}
	if err = tx.Commit(ctx); err != nil {
		admin.Close()
		t.Fatal(err)
	}
	schema := fmt.Sprintf("ids_test_%d", time.Now().UnixNano())
	identifier := pgx.Identifier{schema}.Sanitize()
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+identifier); err != nil {
		admin.Close()
		t.Fatal(err)
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if err = migrations.Up(ctx, pool); err != nil {
		pool.Close()
		_, _ = admin.Exec(ctx, "DROP SCHEMA "+identifier+" CASCADE")
		admin.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		_, _ = admin.Exec(context.Background(), "DROP SCHEMA "+identifier+" CASCADE")
		admin.Close()
	})
	return pool
}
