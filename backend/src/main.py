from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
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

    dist_root = _DIST.resolve()

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_files(full_path: str):
        """Any file in the PWA build (sw.js, push-sw.js, demo/, icons/…); else the app shell."""
        if full_path.startswith("api/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        if full_path:
            candidate = (dist_root / full_path).resolve()
            # Never serve outside the build folder (path traversal)
            if candidate.is_file() and candidate.is_relative_to(dist_root):
                return FileResponse(candidate)
        return FileResponse(dist_root / "index.html")
