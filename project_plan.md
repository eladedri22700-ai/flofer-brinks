# FLOFER BRINKS - Project Plan

## Overview

FLOFER BRINKS is a premium Hebrew-RTL PWA for Brinks team leaders. It plans and runs daily cash-logistics rounds (10-25 stops) with VRPTW optimization, time windows, VIP weights, traffic-aware ETAs, smart breaks, live geofenced navigation, learning, personal work-hour analytics, and Telegram field alerts.

## Status

**FIELD PILOT READY (Jul 2026)** — Phases 1–5 complete. Visual day-board + Telegram test shipped.

| Stage | Focus | Status |
|-------|--------|--------|
| A | Premium light+dark UX (Secular One / Varela Round, 3D buttons, IA) | done |
| B | Morning flow polish (input / OCR / conflicts / route explain) | done |
| C | Live realtime (approach alert, dynamic return ETA, depot geofence) | done |
| D | Learning + dashboard AI tips | done |
| E | Telegram bot alerts + test ping | done (needs user bot token + chat id) |
| F | Offline / GPS permissions / PWA hardening | done |
| G | Live keys, HTTPS deploy, dry-run DoD | done — https://flofer-brinks.onrender.com |
| H | Round confirm board (`/app/board`) — map + addresses + live GPS + Start | done |
| I | First-run onboarding (A2HS + location + notifications) | done |

**Theme:** light default + dark toggle. Typography: Secular One (display) · Varela Round (UI) · IBM Plex Mono (data).

**Depot:** start = end = Brinks office via `GET/PUT /api/settings/depot`.

**Telegram:** `TELEGRAM_BOT_TOKEN` + user `telegram_chat_id` / `telegram_enabled` + `POST /api/settings/telegram/test`.

**Board:** `/app/board` — full-bleed map of today's round (depot loop, numbered pins, addresses, ETA list, print).

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React 18 + TypeScript + Vite + PWA |
| Offline | idb-keyval queue |
| Backend | FastAPI + SQLAlchemy + Alembic + OR-Tools |
| DB | PostgreSQL 16 |
| Auth | JWT + demo Bearer `demo` |
| Maps / OCR | Google / Anthropic or mock |
| Alerts | Telegram Bot API |
| Export | CSV + PDF (reportlab) |
| Deploy | Render free (Docker + Postgres) · local Docker Compose |

## Phase Roadmap

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation | done |
| 2 | Data Core | done |
| 3 | Route Engine | done |
| 4 | Live Mode + capture | done |
| 5 | Intelligence + Polish | done |
| Pilot pack | Docker, scripts, compare API, docs | done |
| Field finish | UX + Telegram + board map + DoD | done (Render free pilot) |

## Architecture decisions

1. VRPTW makespan - never nearest-neighbor
2. Geofence assists; manual always works
3. Never auto-reorder without approval
4. Learned values only at sample_count ≥ 3
5. Work hours = tracking/display, not payroll
6. Demo data never mixes with real rows
7. Telegram failures must never block Live actions

## Next steps

1. Field pilot tomorrow on phone: https://flofer-brinks.onrender.com (`leader` / `Brinks2026!`)
2. GCP Browser Key HTTP referrer: `https://flofer-brinks.onrender.com/*`
3. User configures Telegram bot + Chat ID and runs «שלח הודעת בדיקה»
4. Free Render Postgres expires ~30 days; free web sleeps after ~15m idle (cold start 30–60s)

## Verify

```bash
# Windows
.\start-dev.ps1

# Migrate (includes Telegram prefs)
cd backend && alembic upgrade head

# Or
docker compose up -d --build
cd backend && pytest -q
cd frontend && npm test && npm run build
```

Open http://127.0.0.1:5180/app/board after optimizing a route.

## Field dry-run checklist

See plan: approach banner, Waze on parking pin, Telegram start, offline complete, return ETA updates, summary + dashboard tips, board print for morning brief.

## Post-pilot (Stage 2 - out of scope)

Multi-user admin dashboard, SSO, fleet view, payroll integration, WhatsApp Business, Weather API.
