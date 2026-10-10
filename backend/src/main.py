from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.api.router import api_router
from src.core.config import get_settings
from src.core.exceptions import AppError, app_error_handler, unhandled_error_handler
from src.core.logging import setup_logging

setup_logging()
settings = get_settings()

app = FastAPI(title="FLOFER BRINKS", version="1.0.0")
_cors = settings.cors_origin_list
# Same-origin PWA + pilot flexibility: allow configured origins, or * when empty/"*"
if not _cors or _cors == ["*"]:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Permissions-Policy", "camera=(self), geolocation=(self), microphone=()")
    if request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000")
    return response


@app.on_event("startup")
async def start_live_watch() -> None:
    """Background watcher: live forecasts + push alerts while the app is closed."""
    import asyncio

    from src.services.live_watch import run_forever

    if os.environ.get("LIVE_WATCH", "true").lower() != "false":
        app.state.live_watch = asyncio.create_task(run_forever())


app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)
app.include_router(api_router)


def _resolve_frontend_dist() -> Path | None:
    candidates = [
        Path(os.environ["FRONTEND_DIST"]) if os.environ.get("FRONTEND_DIST") else None,
        Path(__file__).resolve().parents[1] / "frontend" / "dist",  # Docker: /app/frontend/dist
        Path(__file__).resolve().parents[2] / "frontend" / "dist",  # local monorepo
    ]
    for path in candidates:
        if path is not None and path.is_dir() and (path / "index.html").is_file():
            return path
    return None


_DIST = _resolve_frontend_dist()
if settings.serve_frontend and _DIST is not None:
    assets = _DIST / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="assets")

    def _dist_file(name: str) -> FileResponse | None:
        candidate = _DIST / name
        return FileResponse(candidate) if candidate.is_file() else None

    @app.get("/")
    def spa_root():
        return FileResponse(_DIST / "index.html")

    @app.get("/app/{full_path:path}")
    def spa_app(full_path: str):
        return FileResponse(_DIST / "index.html")

    @app.get("/icons/{file_path:path}")
    def spa_icons(file_path: str):
        candidate = _DIST / "icons" / file_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_DIST / "index.html")

    @app.get("/manifest.webmanifest")
    def spa_manifest():
        return _dist_file("manifest.webmanifest") or FileResponse(_DIST / "index.html")

    @app.get("/sw.js")
    def spa_sw():
        return _dist_file("sw.js") or FileResponse(_DIST / "index.html")

    @app.get("/registerSW.js")
    def spa_register_sw():
        return _dist_file("registerSW.js") or FileResponse(_DIST / "index.html")

    @app.get("/workbox-{rest:path}")
    def spa_workbox(rest: str):
        return _dist_file(f"workbox-{rest}") or FileResponse(_DIST / "index.html")
