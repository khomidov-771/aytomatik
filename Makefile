.PHONY: dev test migrate seed

dev:
	docker compose up --build

test:
	cd api && go test ./...
	npm test

migrate:
	cd api && go run ./cmd/migrate up

seed:
	cd api && go run ./cmd/seed

