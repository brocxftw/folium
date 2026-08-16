.PHONY: up down build test backend-test frontend-test migrate logs

COMPOSE_DEV := docker compose -f docker-compose.yml -f compose.dev.yaml

up:
	$(COMPOSE_DEV) up -d

down:
	docker compose down

build:
	$(COMPOSE_DEV) build

logs:
	$(COMPOSE_DEV) logs -f api worker web

migrate:
	cd backend && .venv/bin/alembic upgrade head

backend-test:
	cd backend && .venv/bin/pytest -q

frontend-test:
	cd frontend && npm test && npm run build

test: backend-test frontend-test
