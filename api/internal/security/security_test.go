package security

import (
	"strings"
	"testing"
)

func TestPasswordAndTokenCipher(t *testing.T) {
	hash, err := HashPassword("S3cure-password")
	if err != nil || !CheckPassword(hash, "S3cure-password") {
		t.Fatal("password roundtrip failed")
	}
	if CheckPassword(hash, "wrong-password") {
		t.Fatal("wrong password accepted")
	}
	cipher, err := NewTokenCipher([]byte("01234567890123456789012345678901"))
	if err != nil {
		t.Fatal(err)
	}
	encrypted, err := cipher.Encrypt("secret-token")
	if err != nil || encrypted == "secret-token" || strings.Contains(encrypted, "secret-token") {
		t.Fatal("token was not encrypted")
	}
	plain, err := cipher.Decrypt(encrypted)
	if err != nil || plain != "secret-token" {
		t.Fatal("token roundtrip failed")
	}
}

func TestPasswordRejectsBcryptTruncationBoundary(t *testing.T) {
	if _, err := HashPassword(strings.Repeat("a", 73)); err == nil {
		t.Fatal("password longer than bcrypt's 72-byte boundary was accepted")
	}
	if _, err := HashPassword("qisqa"); err == nil {
		t.Fatal("password shorter than eight characters was accepted")
	}
}
