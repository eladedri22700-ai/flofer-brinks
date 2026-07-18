# FLOFER BRINKS — production image (PWA + FastAPI + OR-Tools)
FROM node:20-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install
COPY frontend/ ./
ENV VITE_API_BASE_URL=
RUN npm run build

FROM python:3.11-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/alembic.ini .
COPY backend/alembic ./alembic
COPY backend/src ./src
COPY --from=frontend /fe/dist ./frontend/dist

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV SERVE_FRONTEND=true
ENV FRONTEND_DIST=/app/frontend/dist

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && python -m src.seed && uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
