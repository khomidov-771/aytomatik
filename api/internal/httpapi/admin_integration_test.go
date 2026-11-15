//go:build integration

package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/ids-automate/ids-automate/api/internal/config"
	"github.com/ids-automate/ids-automate/api/internal/security"
	"github.com/ids-automate/ids-automate/api/internal/store"
	"github.com/ids-automate/ids-automate/api/internal/testdb"
)

func TestAdminRequiresCorrectInstagramSession(t *testing.T) {
	ctx := context.Background()
	db := &store.Store{DB: testdb.Open(t)}
	create := func(id string) string {
		t.Helper()
		user, _, err := db.CompleteInstagramLogin(ctx, store.AccountInput{InstagramUserID: id, Username: id, Provider: "meta", LoginMode: "instagram", TokenCiphertext: "ciphertext", AccountType: "BUSINESS"}, "hash", "register", time.Now())
		if err != nil {
			t.Fatal(err)
		}
		suffixes := []string{"instagram:" + id, "email"}
		if id != "owner-id" {
			suffixes = append(suffixes, "instagram:owner-id")
		}
		for _, suffix := range suffixes {
			user.SessionAuth = suffix
			token := id + "-" + suffix
			if err = db.CreateSession(ctx, user, security.TokenHash(token), "csrf", time.Now().Add(time.Hour)); err != nil {
				t.Fatal(err)
			}
		}
		return id
	}
	create("owner-id")
	create("other-id")
	cfg := config.Config{SuperAdminInstagramID: "owner-id"}
	handler := New(cfg, db, nil, nil, nil).Handler()
	for _, tc := range []struct {
		token string
		code  int
	}{
		{"", 401}, {"other-id-instagram:other-id", 403}, {"owner-id-email", 403}, {"other-id-instagram:owner-id", 403}, {"owner-id-instagram:owner-id", 200},
	} {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/overview?kind=accounts&offset=0", nil)
		if tc.token != "" {
			req.AddCookie(&http.Cookie{Name: "ids_session", Value: tc.token})
		}
		result := httptest.NewRecorder()
		handler.ServeHTTP(result, req)
		if result.Code != tc.code {
			t.Fatalf("%s: got %d %s", tc.token, result.Code, result.Body.String())
		}
		if strings.Contains(result.Body.String(), "ciphertext") {
			t.Fatal("credential leaked")
		}
	}
	var count int
	if err := db.DB.QueryRow(ctx, `SELECT count(*) FROM audit_logs WHERE action='super_admin.view'`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("audit count %d: %v", count, err)
	}
}
