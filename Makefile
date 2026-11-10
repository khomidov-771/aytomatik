.PHONY: dev test migrate

dev:
	docker compose up --build

test:
	cd api && go test ./...
	npm test

migrate:
	cd api && go run ./cmd/migrate up

