#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "== RouteMaster local start =="

if command -v docker >/dev/null 2>&1; then
  docker compose up -d db
else
  echo "Docker not found — assuming local Postgres on :5432"
fi

if [[ ! -x backend/.venv/bin/python ]]; then
  (cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt)
fi

(
  cd backend
  .venv/bin/alembic upgrade head
  .venv/bin/python -m src.seed
  .venv/bin/uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
) &

(
  cd frontend
  [[ -d node_modules ]] || npm install
  npm run dev
) &

echo "API: http://127.0.0.1:8000/api/health"
echo "App: http://127.0.0.1:5180/app/plan"
wait
