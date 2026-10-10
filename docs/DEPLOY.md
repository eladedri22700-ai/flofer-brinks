# העלאה לאוויר — שרת, מסד נתונים ודומיין (חינם / הכי זול)

המדריך הזה מחזיר את FLOFER BRINKS לאוויר בצורה יציבה, בעלות **0 ₪** (או ~40 ₪ לשנה אם רוצים דומיין משלכם).

## למה האתר נפל (ספטמבר 2026)

מסד הנתונים החינמי של Render **פג אחרי 30 יום**. החידוש האוטומטי (GitHub Action) נכשל כי מפתח ה־API של Render בוטל (שגיאה 401). בלי מסד נתונים השרת לא עולה.

**הפתרון:** מעבירים את מסד הנתונים ל־**Neon**. השכבה החינמית שלו לא פגה אחרי 30 יום (0.5GB, מספיק לשנים של סבבים). השרת נשאר ב־Render החינמי.

| רכיב | שירות | מחיר |
|------|-------|------|
| שרת + אפליקציה | Render Free (Docker) | 0 ₪ |
| מסד נתונים | Neon Free Postgres | 0 ₪ |
| מפות וכתובות | OpenStreetMap (מובנה, בלי מפתח) | 0 ₪ |
| דומיין (אופציונלי) | Cloudflare Registrar ‎.com | ~40 ₪ לשנה |

> Google Maps כבר לא חובה. בלי מפתח, או כשהחיוב ב־Google כבוי, האפליקציה עוברת לבד ל־OpenStreetMap: חיפוש כתובות, זמני נסיעה ומפה.

---

## שלב 1 — מסד נתונים ב־Neon (5 דקות)

1. נכנסים ל־https://neon.tech ופותחים חשבון (אפשר עם Google/GitHub).
2. **Create project**:
   - Name: `flofer-brinks`
   - Postgres version: 16
   - Region: **AWS Europe Central (Frankfurt)** — אותו אזור כמו השרת ב־Render
3. בלוח הבקרה לוחצים **Connect** ומעתיקים את ה־**Connection string**. הוא נראה כך:
   ```
   postgresql://neondb_owner:xxxx@ep-xxxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
   שמרו אותו. זה הערך של `DATABASE_URL`.

## שלב 2 — חיבור השרת ב־Render (3 דקות)

1. https://dashboard.render.com → השירות **flofer-brinks** → **Environment**.
2. עורכים את `DATABASE_URL` ומדביקים את המחרוזת מ־Neon.
3. מוודאים שקיימים גם:
   - `FREE_GEO` = `true`
   - `SEED_RESET_PASSWORDS` = `false`
4. **Save, rebuild and deploy**.
5. אחרי 3–5 דקות בודקים: https://flofer-brinks.onrender.com/api/health. צריך לחזור `{"status":"ok"...}`.

בעלייה הראשונה השרת יוצר את הטבלאות לבד (`alembic upgrade head`) ואת משתמשי ההתחלה (seed).

### אחרי שהכל עובד
- מוחקים ב־Render את מסד הנתונים הישן שפג (`flofer-brinks-db-v2`), אם הוא עדיין מופיע.
- ב־GitHub → Settings → Secrets אפשר למחוק את `RENDER_API_KEY`. כבר לא צריך אותו.

## שלב 3 — כניסה ראשונה ואבטחה

משתמשי ההתחלה נוצרים עם סיסמה ראשונית. **מיד אחרי הכניסה הראשונה:**

**עוד → הגדרות → חשבון וסיסמה → עדכון סיסמה** (לפחות 6 תווים).

מעכשיו פריסות חדשות **לא** מאפסות סיסמאות (`SEED_RESET_PASSWORDS=false`).
כניסה נחסמת ל־5 דקות אחרי 8 ניסיונות שגויים.

## שלב 4 — "שרת ער" (כבר מוגדר)

השרת החינמי של Render נרדם אחרי 15 דקות בלי שימוש, והעלייה לוקחת 30–60 שניות.
ה־GitHub Action ‏`keep-render-awake` שולח בדיקה כל 10 דקות ושומר עליו ער. לא צריך לעשות כלום.

אם רוצים שרת שלעולם לא נרדם: Render Starter עולה ‎$7 לחודש. משנים את `plan: free` ל־`plan: starter` ב־`render.yaml`.

## שלב 5 (אופציונלי) — דומיין משלכם

### הכי זול: ‎.com דרך Cloudflare (~$10.5 לשנה, מחיר עלות)
1. https://dash.cloudflare.com → **Domain Registration → Register Domains**, למשל `flofer-brinks.com`.
2. ב־Render: השירות → **Settings → Custom Domains → Add** → `app.flofer-brinks.com`.
3. Render יציג רשומת **CNAME**. ב־Cloudflare → DNS → **Add record**:
   - Type: `CNAME`, Name: `app`, Target: `flofer-brinks.onrender.com`
   - Proxy status: **DNS only** (ענן אפור). זה נדרש כדי ש־Render יוציא תעודת SSL.
4. ממתינים לסימן ✓ ב־Render (בדרך כלל דקות). HTTPS מגיע חינם.
5. ב־Render → Environment: `APP_PUBLIC_URL` = `https://app.flofer-brinks.com` → Deploy.

### דומיין ישראלי ‎.co.il
דרך רשם מוסמך (למשל Domain The Net, LiveDNS או Box). בערך 60–90 ₪ לשנה. אחר כך אותם צעדים 2–5.

> אחרי מעבר דומיין, משתמשים צריכים להתקין את האפליקציה מחדש למסך הבית מהכתובת החדשה.

## שלב 6 (אופציונלי) — Google Maps

לא חובה. אם רוצים זמני נסיעה עם פקקים בזמן אמת:
1. ב־Google Cloud Console מפעילים **Billing** בפרויקט. יש קרדיט חודשי חינמי שמספיק לצוות אחד.
2. מפעילים: Routes API, Geocoding API, Places API (New), Maps JavaScript API.
3. מגבילים את ה־Browser Key ל־HTTP referrer של הכתובת שלכם (`https://flofer-brinks.onrender.com/*` או הדומיין החדש).
4. מדביקים את המפתחות ב־Render → Environment ‏(`GOOGLE_MAPS_SERVER_KEY`, `GOOGLE_MAPS_BROWSER_KEY`).

אם Google ייכשל אי פעם, האפליקציה תחזור אוטומטית ל־OpenStreetMap. הסבב לא ייחסם.

---

## בדיקה מהירה אחרי פריסה

- [ ] ‏`/api/health` מחזיר `ok`
- [ ] כניסה עם המשתמש והחלפת סיסמה
- [ ] תכנון → הוספת 2 כתובות (חיפוש כתובת מציע תוצאות)
- [ ] חשב מסלול → המפה מוצגת עם נקודות ממוספרות
- [ ] התחל סבב → מסך נסיעה, «הגעתי», «סיימתי כאן»
- [ ] בטלפון: התקנה למסך הבית, ואישור מיקום והתראות
