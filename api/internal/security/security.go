package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"strings"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
)

func HashPassword(password string) (string, error) {
	if utf8.RuneCountInString(password) < 8 || len([]byte(password)) > 72 {
		return "", errors.New("password must contain at least 8 characters and at most 72 UTF-8 bytes")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	return string(hash), err
}

func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func RandomToken(bytes int) (string, error) {
	b := make([]byte, bytes)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func TokenHash(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}

type TokenCipher struct{ aead cipher.AEAD }

func NewTokenCipher(key []byte) (*TokenCipher, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &TokenCipher{aead: aead}, nil
}

func (c *TokenCipher) Encrypt(plain string) (string, error) {
	nonce := make([]byte, c.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := c.aead.Seal(nonce, nonce, []byte(plain), []byte("ids-instagram-token-v1"))
	return base64.RawStdEncoding.EncodeToString(sealed), nil
}

func (c *TokenCipher) Decrypt(encoded string) (string, error) {
	data, err := base64.RawStdEncoding.DecodeString(strings.TrimSpace(encoded))
	if err != nil || len(data) < c.aead.NonceSize() {
		return "", errors.New("invalid encrypted token")
	}
	nonce, ciphertext := data[:c.aead.NonceSize()], data[c.aead.NonceSize():]
	plain, err := c.aead.Open(nil, nonce, ciphertext, []byte("ids-instagram-token-v1"))
	if err != nil {
		return "", errors.New("token decryption failed")
	}
	return string(plain), nil
}
