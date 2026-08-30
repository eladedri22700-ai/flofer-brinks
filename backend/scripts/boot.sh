#!/bin/sh
# Fail fast if Postgres is unreachable (expired free DB / wrong URL).
set -eu
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-10}"

echo "boot: waiting for database (timeout ${PGCONNECT_TIMEOUT}s)..."
python - <<'PY'
import os, sys
from urllib.parse import urlparse
import psycopg2

raw = os.environ.get("DATABASE_URL", "").strip()
if not raw:
    print("boot: DATABASE_URL is missing", file=sys.stderr)
    sys.exit(1)

# psycopg2 accepts postgres:// and postgresql://
url = raw.replace("postgresql+psycopg2://", "postgresql://", 1)
timeout = int(os.environ.get("PGCONNECT_TIMEOUT", "10"))
try:
    conn = psycopg2.connect(url, connect_timeout=timeout)
    conn.close()
except Exception as exc:
    print(f"boot: database unreachable: {exc}", file=sys.stderr)
    print(
        "boot: If this is Render free Postgres, it may have expired (30 days). "
        "Create a new free DB and set DATABASE_URL, then redeploy.",
        file=sys.stderr,
    )
    sys.exit(1)
print("boot: database ok")
PY

echo "boot: alembic upgrade..."
alembic upgrade head
echo "boot: seed..."
python -m src.seed
echo "boot: starting uvicorn on :${PORT:-8000}"
exec uvicorn src.main:app --host 0.0.0.0 --port "${PORT:-8000}"
