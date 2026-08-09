.PHONY: up down build test backend-test frontend-test migrate logs

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f api worker web

migrate:
	cd backend && .venv/bin/alembic upgrade head

backend-test:
	cd backend && .venv/bin/pytest -q

frontend-test:
	cd frontend && npm test && npm run build

test: backend-test frontend-test
