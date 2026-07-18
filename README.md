# FLOFER BRINKS

PWA בעברית לניהול סבבי ברינקס — תכנון VRPTW, Live Mode, למידה, לוח בקרה אישי והתראות Telegram.

**סטטוס:** FIELD PILOT HARDENING (Phases 1–5 + UX פרימיום + Telegram + התקרבות ליעד)

## Stack

- Frontend: React 18 + TypeScript + Vite PWA
- Backend: Python 3.11 + FastAPI + OR-Tools + PostgreSQL 16

## הרצה מהירה (Windows)

```powershell
.\start-dev.ps1
```

או ידנית:

### 1. Database

```bash
docker compose up -d db
```

### 2. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
alembic upgrade head
python -m src.seed
uvicorn src.main:app --reload --port 8000 --host 127.0.0.1
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

פתחו: **http://127.0.0.1:5180/app/dashboard**

`/api` מופנה אוטומטית ל־`:8000` (Vite proxy). `VITE_API_BASE_URL` ריק = מומלץ.

## Docker מלא (API + DB)

```bash
docker compose up -d --build
# API: http://127.0.0.1:8000/api/health
# Seed חד־פעמי:
docker compose exec api python -m src.seed
```

לשירות UI יחד עם API: בנו פרונט (`npm run build`) והגדירו `SERVE_FRONTEND=true` ב־API.

## Seed / כניסה

| שדה | ערך |
|-----|-----|
| Username | `leader` |
| Password | `Brinks2026!` |
| Demo token | `Bearer demo` |

מצב הדגמה מלא: **עוד → הגדרות → הפעל הדגמה** (18 לקוחות מבודדים).

## Environment

**backend/.env**
- `DATABASE_URL`, `JWT_SECRET`
- `CORS_ORIGINS` — כתובות ה־UI בפרודקשן
- `DEMO_AUTH=true` לפיילוט
- `SERVE_FRONTEND=true` אם מגישים את `frontend/dist` מאותו שרת
- מפתחות Google / Anthropic אופציונליים (אחרת mock)
- `TELEGRAM_BOT_TOKEN` — בוט להתראות שטח
- `APP_PUBLIC_URL` — קישור חזרה ל־PWA בהודעות Telegram

**frontend/.env**
- `VITE_API_BASE_URL=` (ריק ל־proxy / same-origin)
- `VITE_SENTRY_DSN` אופציונלי

## Deploy לפיילוט (HTTPS לטלפון)

### אפשרות מהירה — מנהרת Cloudflare (מומלץ לשטח)

מהמחשב שעליו רצה האפליקציה:

```powershell
.\start-field.ps1 -Detach
```

הסקריפט בונה את ה־PWA, מגיש API+UI יחד (`SERVE_FRONTEND=true`), ופותח מנהרת HTTPS ציבורית.  
כתובת הטלפון נשמרת ב־`tools/field-url.txt`.

1. פתחו בטלפון: `https://….trycloudflare.com/app/dashboard`  
2. «הוסף למסך הבית» / Install  
3. התחברות: `leader` / `Brinks2026!`  
4. ב־GCP (Browser Key) הוסיפו referrer: `https://*.trycloudflare.com/*`

לעצירה: ראו את שורת `Stop-Process` בפלט הסקריפט.

### Deploy קבוע (ענן)

1. Postgres מנוהל + גיבוי יומי  
2. `alembic upgrade head` + seed משתמש  
3. Backend מאחורי HTTPS  
4. Frontend: `npm run build` → CDN/static **או** `SERVE_FRONTEND=true`  
5. הגבלת מפתחות Google ל־referrer/IP  

## התקנה בטלפון — 3 שלבים

1. Chrome/Safari בטלפון → כתובת ה־PWA ב־**HTTPS** (מ־`start-field.ps1` או שרת ענן).  
2. מסך הדרכה חד־פעמי: הוספה למסך הבית · אישור מיקום · התראות.  
3. תכנון → חשב מסלול → אישור סבב → התחל סבב.

לאיפוס ההדרכה במכשיר: מחקו מ־localStorage את `flofer_onboarding_v1`.

## Telegram (אופציונלי לפיילוט)

1. צרו בוט ב־@BotFather והדביקו את הטוקן ב־הגדרות / `.env`.  
2. פתחו את הבוט ולחצו Start; העתיקו Chat ID (למשל מ־@userinfobot).  
3. בהגדרות האפליקציה: הזינו Chat ID והפעילו התראות.

## בדיקות

```bash
cd backend && python -m pytest -q
cd frontend && npm test
cd frontend && npx playwright install && npm run test:e2e
```

## זרימת יום עבודה

תכנון → חשב מסלול → מסלול (אישור) → נסיעה → סיכום → לוח בקרה / היסטוריה
