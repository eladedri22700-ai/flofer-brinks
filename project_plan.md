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
| J | End-of-day blessing + auto GPS stop lifecycle + timing learning | done (2026-07-18) |

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
| Auth | JWT per user (no shared demo Bearer in production) |
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

1. **Daniel (fresh invite):** https://flofer-brinks.onrender.com/?user=FLOFER&fresh=1 — must type `FLOFER` / `1234`, then full onboarding + tour (resets leftover session)
2. **Tester sandbox (Elad):** https://flofer-brinks.onrender.com/?sandbox=1 — auto `TEST` / `1234`, blue banner, zero effect on Daniel
3. **Before pilot:** set real Brinks depot in Settings (shared office coords; seed is temporary Tel Aviv)
4. GCP Browser Key HTTP referrer: `https://flofer-brinks.onrender.com/*`
5. Telegram bot + Chat ID per user; «שלח הודעת בדיקה»
6. Free Render Postgres expires ~30 days; free web sleeps after ~15m idle (cold start 30–60s)

**Pilot cleanliness (2026-07-18):** purged smoke-test stops from production; fresh `planning` route for today (empty).

**Completed (2026-07-18 — Stage J):**
- Auto-arrive (~20s in geofence) and auto-complete (~45s outside) without manual mark
- Auto-complete previous stop when crew reaches next stop geofence
- Depot enter closes the work day and navigates to summary with Hebrew blessing
- Service/leg samples keep feeding learned ETAs (median / p80)

**Completed (2026-07-18 — Board map UX):**
- Board split layout: map + address list both always visible on mobile
- Map resize/fitBounds after layout; larger numbered pins; clearer road labels
- Expert board polish: metrics strip (next/return), list↔map sync + scroll, time-window chips, print, focus zoom on pin select

**Completed (2026-07-18 — Home / order model):**
- `get_today_route` prefers in_progress over empty planning clones; `create_route` won't spawn a second today-route
- Manual reorder no longer knocks a live round out of `in_progress`
- Dashboard: status-aware CTA + full stop order list + «שנה סדר ידנית» → `/app/route`

**Completed (2026-07-18 — Copyright):**
- In-app `/app/legal` Hebrew terms + © notice in More sheet / Settings; repo `COPYRIGHT.txt`

**Completed (2026-07-18 — Live first-run tour):**
- Permissions → live coach-mark tour with demo on; finish disables demo for real shift tomorrow
- Replay from Settings «הפעל הדרכה מחדש»

**Completed (2026-07-18 — Tour settings + account isolation):**
- Tour covers Settings: depot, day/night theme, drive/SOS prefs
- Login gate (no shared `demo` session in prod); pilot `FLOFER`/`1234` + `elad` / `leader`
- Demo seed/purge scoped per `user_id` so one phone cannot wipe another's demo
- Logout clears saved login; successful login auto-saves credentials + JWT ~30 days

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
