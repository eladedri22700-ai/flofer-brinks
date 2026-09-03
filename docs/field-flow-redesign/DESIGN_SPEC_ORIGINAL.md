# Handoff: FLOFER BRINKS — Field Round Flow (עברית / RTL)

## Overview

FLOFER BRINKS is a Hebrew-language field PWA for managing Brinks cash-logistics rounds. The user is a **field team lead** who runs 10–25 stops a day and must plan, execute and close a round under time pressure, with a list that changes mid-drive, VIP time windows and service constraints.

The core promise: **the round is ordered for the fastest return to the branch**, not for the nearest next address — and every change (added stop, manual reorder, failed stop) immediately shows its cost in minutes against the return ETA.

This handoff covers a full redesign of the app's field flow: 11 screens plus overlays, one continuous day.

Repo association is recorded at the project root in `github.md`:
`repo: eladedri22700-ai/flofer-brinks`, `branch: main`, `path: frontend/src`.
That file also holds a screen → repo-file map. The existing app is React + TypeScript with CSS modules and `tokens.css`; this redesign supersedes the visual layer of `DashboardPage`, `RoutePage` and `LivePage`.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior. They are **not production code to copy**. The task is to **recreate these designs inside the existing `frontend/` React codebase**, using its established patterns: CSS modules, the `tokens.css` custom properties, existing `ui/Button`, `ui/Card`, `layout/BottomNav` components, and the app's routing. Where a token does not exist yet for a value listed below, add it to `tokens.css` rather than hardcoding it in a component.

The prototype is a single-file design component; do not mirror its file structure. Mirror its **screens, states, hierarchy and exact values**.

## Fidelity

**High fidelity.** Colors, typography, sizes, radii and copy are final and should be recreated precisely. The one exception is the map screen — it is a schematic diagram, not a real map (see Assets).

## Files

- `FLOFER Prototype.dc.html` — the interactive flow. Every screen and overlay listed below is reachable by clicking.
- `FLOFER System.dc.html` — the design system page: palette, type, action sizes, components, rules.
- `FLOFER Directions.dc.html` — three earlier visual directions (Refined Vault / Field HUD / Manifest), kept for reference only. **Not** the direction to build.

Open the prototype and click through: פתיחת משמרת → צילום מסך → בניית מסלול → המשך לעצירה → הגעתי → סיימתי. The «עוד» tab reaches map, reorder, add-stop and hours.

---

## Design Tokens

### Color

| Name | Value | Use |
| --- | --- | --- |
| Ink | `#0A1626` | Driving-mode background, primary text, primary CTA |
| Ink 2 | `#16263F` | Radial highlight at top of driving screens |
| Brass | `#C9A227` | Decision accent (solid) |
| Brass light | `#E8C65A` | Primary numeral in driving mode, progress head |
| Brass gradient | `linear-gradient(160deg,#F0D78A,#D4AF37 48%,#B8922A)` | Primary action in driving mode |
| Brass text (on light) | `#A87F14` | Links, section eyebrow, active nav |
| Done | `#1FAA63` | Completed stop, time saved, "סיימתי כאן" |
| Exception | `#8A2F2F` | VIP marker, "לא בוצע" outline (light surfaces) |
| Exception light | `#FF9A7A` / `#FFD0BD` / `#E0A48C` | Alert icon / title / subtitle on Ink |
| Waze blue | bg `rgba(42,102,200,.2)`, border `rgba(96,152,255,.4)`, text `#CFE0FF` | Navigation action in driving mode |
| Day bg | `#F7F5F0` | Light-mode page background |
| Surface | `#FFFFFF` | Cards, sheets |
| Surface alt | `#F2F0EA` | Tertiary buttons, inline chips |
| Map bg | `linear-gradient(180deg,#E4E2DB,#DCDAD2)`; roads `#D3D0C6` (12px) and `#CAC7BC` (5px) | Map screen only |
| Body text | `#3D516C` | Paragraph text on light |
| Muted | `#8B97A8` | Labels, meta on light |
| Muted (dark) | `#93A7C2` | Labels on Ink |
| Muted (dark, quiet) | `#7B8EA9` | Tertiary meta on Ink |
| Disabled numeral | `#B3BCC9` | Past stop times |
| Hairline (light) | `rgba(10,22,38,.08–.10)` | Card borders, dividers |
| Hairline (dark) | `rgba(255,255,255,.08–.09)` | Dividers on Ink |
| Fill (dark) | `rgba(255,255,255,.05–.06)` | Secondary surfaces on Ink |

### Typography

Three families, loaded from Google Fonts:

- **Secular One** (400) — screen titles only. 22px (in-flow header) / 30–32px (page title) / 40px (driving stop name). Line-height 1.1–1.15.
- **Heebo** (300/400/600/800) — everything else.
  - 800: CTAs 17–24px, section titles 16–19px, current stop name 17px
  - 600: stop names 15–17px, secondary buttons 14–16px, nav active
  - 400: body 13.5–15px, line-height 1.45–1.6
  - Eyebrow: 800, 11.5–12px, `letter-spacing: .16–.20em`
- **IBM Plex Mono** (400/600/700) — **all numbers**: times, counters, stop indices, km, durations. Always `font-variant-numeric: tabular-nums`, `direction: ltr; unicode-bidi: isolate` so they don't reflow inside RTL text. Primary numeral 56–78px / weight 700 / line-height .82–.9. Secondary 20–26px.

Minimum body size anywhere: 12px (labels only); real content never below 13px.

### Spacing, radius, elevation

- Spacing scale: 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 26 / 30.
- Screen side margin: **22px** light screens, **24px** driving screens.
- Gap between groups: 16–20px. Inside a card: 20px padding.
- Radius: 12–14px tile / 16–18px button / 20–24px card / 26–28px bottom sheet (`28px 28px 0 0`) / 44px device frame.
- Shadows: card `0 10px 28px rgba(10,22,38,.07)`; dark CTA `0 12px 26px rgba(10,22,38,.22)`; brass CTA `0 16px 38px rgba(212,175,55,.24–.30)`; green CTA `0 18px 38px rgba(31,170,99,.3)`; sheet `0 -20px 50px rgba(10,22,38,.3–.35)`.
- Tap feedback: `transform: scale(.975); filter: brightness(.96)`, transition `120ms cubic-bezier(.2,.8,.2,1)`.

### Action sizes (hard minimums)

| Context | Height |
| --- | --- |
| Light-mode primary | 60–62px |
| Light-mode secondary | 54–58px |
| Light-mode tertiary | 48px |
| Driving primary ("הגעתי") | **78px** |
| Driving primary ("סיימתי כאן") | **80px** |
| Driving secondary | 62px |
| Exception chips | 54px |

### Layout frame

Designed at **390 × 844** (iPhone 14/15 viewport). Status bar 52px tall, content aligned to bottom with 6px padding, side padding 30px. Bottom nav: 4 columns, min-height 78px, padding `10px 8px 24px` (24px is the home-indicator inset), `background: rgba(255,255,255,.94)` + `backdrop-filter: blur(18px)`, top hairline. **Light screens that scroll must reserve 108–118px bottom padding** so content clears the nav.

---

## Six binding rules

1. **One hero number per screen.** Exactly one numeral above 40px; nothing else exceeds 26px.
2. **Driving mode is locked.** No bottom nav, no text links. Two actions, 62px minimum.
3. **Brass means decision.** Brass marks the action the user is in right now — never decoration.
4. **Every change shows its price.** Adding a stop, reordering, or reporting an exception displays the updated return ETA before confirmation.
5. **One question at a time.** Arrival is its own screen. Exceptions are chips and radio rows, never forms.
6. **Numbers are mono and LTR-isolated**, always.

---

## Screens / Views

Route/state names below are suggestions; match the app's router.

### 1. פתיחת משמרת — Shift open (`start`)
**Purpose:** three mandatory pre-drive checks before the round can begin.
**Surface:** Ink with radial highlight `radial-gradient(120% 55% at 50% 0%,#16263F 0%,transparent 60%)`. Padding `12px 24px 26px`, column, gap 20px. Scrollable, no nav.

- Eyebrow `FLOFER · פתיחת משמרת` — Heebo 800, 12px, `.2em`, `#E8C65A`.
- Title `בוקר טוב, אלעד` — Secular One 32px.
- Lead `שלוש בדיקות ואתה בדרך. הכל נרשם על השטר.` — 14.5px, `#93A7C2`.
- **Three check rows**, each a tap target: grid `auto 1fr`, gap 14px, padding `16px 18px`, radius 18px. Unchecked: bg `rgba(255,255,255,.05)`, border `rgba(255,255,255,.09)`, 30px circle `rgba(255,255,255,.12)` with a check glyph at `rgba(255,255,255,.25)`. Checked: bg `rgba(31,170,99,.12)`, border `rgba(31,170,99,.4)`, circle `#1FAA63`, glyph `#FFF`. Titles Heebo 700 16px; subtitles 13px `#93A7C2`:
  1. `בדיקת רכב` / `כספת, דלק, גלגלים`
  2. `זיווג צוות` / `מאור כהן · נהג · אושר`
  3. `קשר ומצלמה` / `מוקד מגיב · שידור תקין`
- **Vehicle strip:** `rgba(255,255,255,.05)` + hairline, radius 18px, padding `16px 18px`, space-between. Left: `רכב` / `BR-418 · ת״א מרכז` (700, 16px). Right: `שעת יציאה` / `07:00` (mono 20px, `#E8C65A`).
- **CTA** 70px, radius 22px, brass gradient, Ink text, Heebo 800 20px. Label `פתיחת משמרת` when all three checked, else `השלם את הבדיקות` at `opacity: .45` and inert. Note under it, centered 12.5px `#7B8EA9`: `הבדיקות נרשמו · 06:58` or `N בדיקות נותרו`.

### 2. תכנון / רשימת היום — List intake (`plan`)
**Purpose:** get today's addresses in. Screenshot-first, because the list arrives on WhatsApp.
**Surface:** `#F7F5F0`, padding `14px 22px 118px`, gap 16px, bottom nav visible.

- Title `רשימת היום` (Secular One 30px). Lead 14.5px `#6B7A90`, max 28ch: `איך נכניס את הכתובות?` → after intake `הרשימה נקראה. אפשר לבנות מסלול.`
- **Three intake tiles** (gap 10px):
  - Primary, Ink, min-height 104px, radius 20px, padding `18px 20px`, 52px icon square `rgba(232,198,90,.16)` with a camera glyph in `#E8C65A`. `צילום מסך` (800, 19px) / `מהוואטסאפ של המשמרת · 3 שניות` (13.5px `#93A7C2`).
  - White, min-height 84px, 48px icon square `rgba(201,162,39,.14)`, list glyph `#A87F14`. `רשימה שמורה` / `סבב שלישי · 16 עצירות`.
  - White, min-height 74px, 48px icon square `rgba(10,22,38,.06)`, plus glyph `#3D516C`. `הקלדה ידנית` / `כתובת אחת בכל פעם`.
- **Success strip** (appears after any intake tap): `rgba(31,170,99,.09)` + `rgba(31,170,99,.28)` border, radius 18px, padding `16px 18px`, 26px green circle with white check. `18 כתובות נקראו` bold + `2 חדשות נשמרו לספרייה` in `#4E6A58`.
- **CTA** `בניית מסלול` — 62px, radius 18px, Ink. `opacity: .45` and inert until intake happened. Pushed to the bottom with `margin-top:auto`, 18px above nav.

### 3. היום — Day timeline (`day`)
**Purpose:** the one screen that answers "where am I and what's left".
**Surface:** `#F7F5F0`, padding `12px 22px 118px`, gap 18px, nav visible.

- Header row: `בוקר טוב, אלעד` (Secular One 22px) + `חמישי · 3.9` (12.5px `#8B97A8`).
- **Hero card** — white, radius 24px, padding 20px, card shadow:
  - Label `צפי חזרה לברינקס` 13px `#6B7A90`.
  - **`15:40`** — mono 700, **62px**, line-height .9. Beside it a pill `‎−38 דק׳`: `#1FAA63` on `rgba(31,170,99,.12)`, radius 999px, padding `4px 9px`, `margin-bottom:10px` to sit on the baseline.
  - **Progress rail:** `07:27` … 10px track `#ECEBE6` … `15:40` (mono 11px `#8B97A8`). Fill `linear-gradient(90deg,#C9A227,#E8C65A)` at `done/total`. Head: 16px circle Ink with 3px white ring and `0 2px 6px rgba(10,22,38,.3)`, positioned at the same percentage.
  - Footer row 12.5px `#6B7A90`: `7 בוצעו` / `11 נותרו · 2 VIP`.
- **CTA** `המשך לעצירה 8` — 62px, Ink, Heebo 800 18px, with a brass chevron `#E8C65A`. Label becomes `סגירת הסבב` when all stops are done.
- **Timeline** — label `הציר של היום`, then a 3-column grid `42px 18px 1fr`, column-gap 10px, showing the previous stop, the current stop, and the next two. Per row:
  - Time: mono, past `#B3BCC9` 13px, current `#0A1626` 15px/700, future `#6B7A90` 13px.
  - Rail: dot + 2px connector `#E0DFD9`. Done dot 11px `#1FAA63`. Current dot 17px `#E8C65A` with 4px Ink border and `0 0 0 5px rgba(232,198,90,.28)` halo. Future dot 11px white with 2.5px `#DCD9CF` border. Connector 44px normally, 58px under the current row, 0 on the last row.
  - Name: done 15px `#A8B2C0` strikethrough; current 17px/800; future 15px/600. Sub-line 13px `#8B97A8` — address, plus `· שירות N דק׳` on the current row. VIP suffix ` ★ VIP`, and on the day timeline a chip `VIP 10:30` (Heebo 800 10px, `#8A2F2F` on `rgba(138,47,47,.1)`, radius 4px).
  - **Tapping a row opens the stop-detail sheet.**
  - Footer link `עוד N עצירות · לצפייה בכל הציר` — 13.5px/600 `#A87F14`, opens the full-round sheet.

### 4. נהיגה — Driving (`live`)
**Purpose:** one glance at 60 km/h. **No bottom nav.**
**Surface:** Ink + top radial `radial-gradient(120% 60% at 50% 0%,#16263F 0%,transparent 62%)`, padding `8px 24px 26px`.

- Progress: 6px track `rgba(255,255,255,.12)`, brass-gradient fill, plus `8/18` mono 12.5px `#93A7C2`.
- Eyebrow `העצירה הבאה` — 800, 11.5px, `.18em`, `#E8C65A`.
- Stop name — **Secular One 40px**, line-height 1.1.
- Address 15.5px `#93A7C2`; detail line 13.5px `#7B8EA9` (`כניסת שירות · חנייה בכיכר`, or `לקוח VIP · חלון זמן קבוע`).
- **Hero numeral `09:58`** — mono 700 **78px**, line-height .82, `#E8C65A`, with a two-line 13px `#7B8EA9` caption `הגעה / משוערת` beside it.
- Return strip: `rgba(255,255,255,.05)` + hairline, radius 18px, padding `14px 18px`. `חזרה לברינקס` / `15:40` (mono 24px/700) + `+6` (700 12px `#F0C04A`).
- **VIP-risk banner** (only while a VIP window is at risk): `rgba(240,120,90,.14)` on `rgba(240,120,90,.42)`, radius 18px, padding `14px 16px`, 32px icon square with a warning glyph `#FF9A7A`. `חלון VIP בסיכון` (700 14.5px `#FFD0BD`) / `דיסקונט עד 10:30 · צפי 10:41` (12.5px `#E0A48C`) + chevron. Opens the VIP dialog. Disappears once the user decides.
- **Actions** (bottom, gap 12px):
  - `הגעתי` — 78px, radius 24px, brass gradient, Ink text, 800 23px, with a pin glyph.
  - Row `1.4fr 1fr`: `נווט ב־Waze` (Waze blue, 62px, radius 20px, 700 17px) and `הרשימה` (`rgba(255,255,255,.06)`, `#93A7C2`) which opens the full-round sheet.
  - Centered 13px `#7B8EA9`: `אחר כך · בנק דיסקונט 10:24` → back to the day screen. On the last stop: `זו העצירה האחרונה`.

### 5. הגעתי — Arrival (`arrived`)
**Purpose:** hold the service clock. One decision.
**Surface:** Ink, padding `14px 24px 26px`, centered text, no nav.

- Status row: 8px green dot + `בנקודה · עצירה 8/18` 13px `#7B8EA9`.
- Stop name Secular One 30px; address 14px `#93A7C2`.
- **Service ring:** 224px circle, `conic-gradient(#E8C65A 0 <elapsed/goal>%, rgba(255,255,255,.1) 0)`, inner 186px Ink disc holding `זמן בנקודה` (12.5px `#7B8EA9`), **`4:06`** (mono 700 52px, ticks every second from arrival), `צפי 7 דק׳`.
- Note line 13.5px `#93A7C2`, min-height 20px — used for the delay confirmation.
- Actions: `סיימתי כאן` — **80px**, radius 24px, `#1FAA63`, white, 800 24px, check glyph. Then three 54px chips `rgba(255,255,255,.06)`: `לא בוצע` → exception screen, `פרטי הנקודה` → detail sheet, `עיכוב` → sets the note `סומן: עיכוב — צפי החזרה יעודכן אוטומטית`.
- `סיימתי כאן` increments done + current index and returns to driving; on the last stop it goes to the summary.

### 6. חריג — Exception report (`exception`)
**Purpose:** report a stop that did not happen, in two picks, and see the cost.
**Surface:** Ink, padding `12px 24px 26px`, gap 18px, scrollable, no nav.

- Header: 42px icon square `rgba(240,120,90,.18)` + warning glyph `#FF9A7A`; `העצירה לא בוצעה` (Secular One 23px) / `<stop> · עצירה 8/18`.
- **Reason** (`מה קרה בפועל?`) — three radio rows, padding `15px 16px`, radius 16px, 20px ring. Unselected: `rgba(255,255,255,.05)` / `rgba(255,255,255,.09)` / ring `rgba(255,255,255,.28)`. Selected: `rgba(232,198,90,.12)` / `rgba(232,198,90,.42)` / ring + 10px fill `#E8C65A`. Options: `הסניף היה סגור`, `אין מזומן להעברה`, `אין מי שיחתום`.
- **Disposition** (`מה קורה עם העצירה`) — panel `rgba(255,255,255,.05)`, two rows radius 14px, same selected/unselected treatment: `חזרה בסוף הסבב` with `14:50`, and `ביטול והעברה למחר` with `דיווח למוקד`.
- **Impact strip** `rgba(232,198,90,.1)` / `rgba(232,198,90,.3)`, text `#E8D9A8` 13.5px:
  - retry → `חזרה בסוף הסבב מוסיפה 22 דקות — צפי חזרה 16:02.`
  - drop → `העצירה תעבור לסבב של מחר. צפי החזרה נשאר 15:34.`
  - neither → `בחר מה קורה עם העצירה כדי לראות את ההשפעה.`
- CTA `שלח דיווח והמשך` — 70px, radius 22px, white on Ink, 800 19px, `opacity: .45` and inert until **both** reason and disposition are picked. Confirming advances the round exactly like "סיימתי כאן". Below it `חזרה — העצירה בוצעה בכל זאת` (14px/600 `#7B8EA9`) returns to arrival.

### 7. סגירת סבב — Close (`summary`)
**Surface:** `#F7F5F0`, padding `16px 22px 108px`, gap 20px, nav visible. Status bar shows `15:34`.

- Eyebrow `סבב נסגר` (`#A87F14`), title `18 עצירות, חזרת 6 דקות לפני הצפי` (Secular One 32px).
- **Times card** — white, radius 24px: `יציאה 07:27` — 2px `#E0DFD9` rule — `חזרה 15:34` (mono 22px/700), then two tiles: `משך סבב 8:07` on `#F7F5F0`, `נחסך מול נאיבי 44 דק׳` on `rgba(31,170,99,.09)` in `#1FAA63`.
- **`מה נלמד היום`** — white card with `rgba(201,162,39,.4)` border, two bullets (7px brass dot, 14px `#3D516C`): service time learned for the last stop, and `בנק דיסקונט — חלון VIP מוקדם מדי, מומלץ 10:45.`
- CTA `סגירת יום ודיווח שעות` (62px, Ink) + link `שכפל את הסבב למחר` (14px/600 `#A87F14`). Both reset the prototype.

### 8. מפת הסבב — Route map (`map`)
**Purpose:** spatial confirmation of the order. Full-bleed, own bottom bar, no nav.

- Header `מפת הסבב` (Secular One 22px) + `7 בוצעו · 11 לפנינו`, and a 40px white close square (X) → day.
- Canvas: `linear-gradient(180deg,#E4E2DB,#DCDAD2)`, road grid `#D3D0C6` at 12px and `#CAC7BC` at 5px. Route casing `rgba(10,22,38,.14)` 16px; completed leg solid `#1FAA63` 7px; upcoming leg `#C9A227` 7px `stroke-dasharray:1 14`. Markers: done 13r `#1FAA63` with white mono numeral; current 19r Ink with 4px `#E8C65A` ring and brass numeral; upcoming 13r white with 3px `#C9A227` ring and `#A87F14` numeral; VIP upcoming uses a `#8A2F2F` ring; branch is a 30px Ink rounded square with `ב` in brass.
- Legend, top-start: `rgba(255,255,255,.92)`, radius 16px, 12.5px rows — `בוצע` / `לפנינו` / `VIP · חלון זמן`.
- Bottom bar (white, hairline top, padding `16px 22px 24px`): current stop name + `נותרו 26.4 ק״מ` (mono), and `חזרה למצב נהיגה` (58px, Ink).

**This is a diagram, not a map.** In production, replace the SVG with the real map provider and keep the marker/leg semantics exactly as specified.

### 9. סדר הנקודות — Manual reorder (`order`)
**Purpose:** override the computed order and see the penalty.

- Header `סדר הנקודות` + subtitle `מסודר לחזרה המהירה ביותר` → `הסדר שונה ידנית — לא נשמר` once touched. Close square → day.
- Scrollable rows (only the current stop onward): grid `30px 1fr auto auto`, padding `12px 14px`, radius 16px, white, hairline, **4px inline-start accent** — first row `#E8C65A`, VIP `#8A2F2F`, otherwise `rgba(10,22,38,.12)`. Index mono 13px/700; name 15.5px/600 with ` ★ VIP`; sub-line mono 12.5px `#8B97A8` = `ETA · address`. Two 38px `#F2F0EA` squares with chevrons move the row up/down; the disabled end drops to `opacity: .25`.
- Bottom bar: `צפי חזרה בסדר הזה` + ETA — `15:40` in `#1FAA63` when untouched, **`16:04` in `#8A2F2F`** once reordered. Buttons `חשב מחדש` (outline, restores the optimal order) and `שמור סדר` (Ink) side by side, 56px.

### 10. הוספת עצירה — Add stop (`add`)
**Purpose:** never accept a mid-round addition blind.

- Header `הוספת עצירה` / `באמצע הסבב · תשובה תוך שניות`, close → driving.
- Address card (white, radius 18px): label `כתובת` + selected address 17px/600.
- Two candidate chips, radius 16px, 1.5px border — selected `#0A1626`, unselected `rgba(10,22,38,.12)`: `בנק מזרחי, ז׳בוטינסקי 7` and `סופרפארם, ביאליק 51`.
- **Impact card** — Ink, radius 22px: `אם נוסיף — הסבב ייראה כך`; `שיבוץ מוצע` (`אחרי עצירה 8 · 10:14` / `אחרי עצירה 10 · 11:03`) and `חזרה לברינקס` (`15:49` / `15:58`, mono 26px `#E8C65A`); a divider then `תוספת 9 דקות · 1.6 ק״מ` / `תוספת 18 דקות · 4.1 ק״מ`.
- Warning strip `rgba(138,47,47,.08)` / `.28`, text `#7A2B2B`: VIP window preserved, or `חזור 18 דקות אחרי הצפי`.
- Bottom bar `1fr 1.4fr`: `בטל` (outline) and `הוסף לסבב` (Ink), 58px.

### 11. שעות עבודה — Weekly hours (`hours`)
- Header `שעות עבודה` / `שבוע 36 · 31.8–4.9`, close → day. Nav visible; last element carries `margin-bottom:110px`.
- **Ink hero card**, radius 24px: `נצבר השבוע`, **`38:12`** (mono 700 56px `#E8C65A`) + `מתוך 42:00`; 10px track with brass-gradient fill at 91%; footer `4 ימי עבודה` / `שעות נוספות 2:40`.
- Day rows, grid `56px 1fr auto`, padding `14px 16px`, radius 18px: day letter (700 14px), range (mono 13.5px `#6B7A90`), total (mono 17px/700). Today: bg `rgba(201,162,39,.1)`, border `rgba(201,162,39,.42)`, day + total in `#A87F14`. Data: ב׳ `07:12–15:48` 8:36 · ג׳ `07:04–16:22` 9:18 · ד׳ `07:20–15:10` 7:50 · **ה׳ `07:27 – בנסיעה` 8:07** · ו׳ `—` 0:00.
- Note card (white, brass border): `השעות נרשמות אוטומטית מזמן היציאה ומהחתימה על סגירת הסבב. תיקון ידני מסומן למנהל המשמרת.`
- CTA `שליחת דיווח שבועי` (58px, Ink).

---

## Overlays

### A. פרטי עצירה — Stop detail (bottom sheet)
Opened by tapping a timeline row, a row in the full-round sheet, or `פרטי הנקודה` on the arrival screen.
Scrim `rgba(4,10,20,.6)`. Sheet white, `28px 28px 0 0`, `max-height: 82%`, header pinned + scrolling body.

- Header: stop name (Secular One 24px) + address (13.5px `#6B7A90`), 36px `#F2F0EA` close square.
- Three stat tiles (`1fr 1fr 1fr`, radius 16px, padding `13px 14px`): `הגעה` ETA, `שירות` `N דק׳`, `מצב` — `בוצע` (`rgba(31,170,99,.1)` / `#1FAA63`) / `נוכחית` (`rgba(201,162,39,.12)` / `#A87F14`) / `ממתינה` (`#F7F5F0` / `#3D516C`).
- Three info rows, each a 34px brass-tinted icon square + title (600 15px) + body (13.5px `#6B7A90`): **חנייה** (`עצירה בכיכר · 40 מ׳ הליכה, נלמד מ־4 ביקורים`, or `חנייה שמורה בחזית · 10 מ׳ הליכה` for VIP), **איש קשר** (`אחראי משמרת · דרך כניסת שירות`, VIP: `מנהל סניף · זמין 09:00–15:00`), **היסטוריה** (`12 ביקורים · ממוצע שירות N דק׳ · חריג אחד בחודש`).
- **Service-time bar chart** on `#F7F5F0`, radius 16px: label `זמני שירות ב־5 הביקורים האחרונים`, five bars in a 56px row, gap 7px, radius `5px 5px 2px 2px`, heights scaled to the max; the last bar is `#C9A227`, the rest `rgba(10,22,38,.16)`. Axis labels `לפני 5 ביקורים` / `אחרון`.
- Footer buttons (`1fr 1fr`, 54px): `נווט לכאן` (outline) and `קבע כעצירה הבאה` (Ink) — the latter sets the current index and jumps to driving.

### B. חלון VIP בסיכון — VIP dialog
Scrim `rgba(4,10,20,.6)`. Floating card, `inset-inline: 14px; bottom: 20px`, white, radius 26px, padding 22px.
- 40px `rgba(138,47,47,.1)` icon square + `חלון VIP בסיכון` (800 17px) / `בנק דיסקונט · חלון עד 10:30`.
- Two tiles side by side: `הגעה בסדר הנוכחי` **`10:41`** in `#8A2F2F` on `#F7F5F0`; `אם נקדים אותו` **`10:12`** in `#1FAA63` on `rgba(31,170,99,.1)`.
- Body: `הקדמה של דיסקונט תדחה את סופר ספיר ב־14 דקות, וצפי החזרה לברינקס יישאר 15:46.`
- `הקדם את דיסקונט` (60px, Ink) and `השאר את הסדר כמו שהוא` (14px/600 `#6B7A90`). Either choice dismisses the banner for the rest of the round.

### C. כל הסבב — Full round sheet
Scrim + white sheet `28px 28px 0 0`, `max-height: 74%`, padding `18px 22px 26px`. Header `כל הסבב` (Secular One 20px) + `סגור` link. Rows: grid `30px 1fr auto`, padding `11px 4px`, hairline bottom — zero-padded index (mono 12.5px `#8B97A8`), `name · address` (done `#A8B2C0` strikethrough, current `#0A1626`, future `#3D516C`), and right column `בוצע` in `#1FAA63` or the ETA in `#8B97A8`. Rows open the detail sheet.

### D. עוד — More menu
Bottom sheet, five rows, grid `44px 1fr auto`, padding `14px 4px`, hairline between: **מפת הסבב** (`כל הנקודות והמסלול`), **סדר הנקודות** (`שינוי ידני וחישוב מחדש`), **הוספת עצירה** (`בדיקת השפעה לפני אישור`, green-tinted icon), **שעות עבודה** (`דיווח שבועי`), **כל הסבב** (`18 עצירות`, neutral icon). Titles 600 16.5px, subtitles 13px `#8B97A8`, chevron `#B3BCC9`.

---

## Bottom navigation

Four items: **היום** (home glyph) · **תכנון** (list glyph) · **נסיעה** (target glyph, with an 8px `#1FAA63` badge and 2px white ring when a round is active) · **עוד** (ellipsis). Active: label `#0A1626` and glyph `#A87F14`; inactive `#8B97A8`. Labels 11.5px.

**Visible on:** היום, תכנון, סגירת סבב, שעות עבודה.
**Hidden on:** נהיגה, הגעתי, חריג, מפה, סדר, הוספת עצירה — each of those owns its own bottom bar or close affordance.
Tapping **נסיעה** goes to driving, or to the summary if the round is already complete.

---

## Interactions & Behavior

Flow: `start` →(all checks)→ `plan` →(intake, then בניית מסלול)→ `day` →(המשך לעצירה)→ `live` →(הגעתי)→ `arrived` →(סיימתי כאן | לא בוצע→`exception`)→ next `live` … → `summary` →(reset)→ `start`.

- **Gating.** `פתיחת משמרת` requires all three checks. `בניית מסלול` requires an intake tap. `שלח דיווח והמשך` requires reason + disposition. Gated buttons render at `opacity: .45` and do nothing on tap — no error copy.
- **Service timer.** Starts at 0 on entering `arrived`, `setInterval` 1000ms, cleared on leaving the screen and on unmount. The conic ring is `elapsed / (goal × 60)`, clamped to 100%.
- **Advancing.** Both `סיימתי כאן` and a confirmed exception increment `done` and `idx`, reset the timer, and return to driving — or go to `summary` when `done >= total`.
- **Reorder.** Operates on the pending slice (current index onward). Any manual move sets `dirty`, which flips the subtitle and the ETA to the penalty state. `חשב מחדש` clears both.
- **Timeline window.** Always renders `idx-1 … idx+2` (clamped). The footer link count is `total - idx - 3`, and collapses to `לצפייה בכל הציר` when non-positive.
- **VIP banner** shows only in driving, only before the last stop, and only until the user decides.
- **Reset** returns every piece of state to its initial value, including checks, order override, VIP decision and add-stop pick.
- **Tap feedback** is the only motion in the design: `scale(.975)` + `brightness(.96)` over 120ms. Sheets should slide up over ~220ms `cubic-bezier(.2,.8,.2,1)` — the prototype does not animate them.
- **RTL.** The whole app is `dir="rtl"`. Use logical properties (`inset-inline-start`, `margin-inline-start`, `padding-inline`) everywhere; the only physical directions are inside numeral runs, which are LTR-isolated.

## State Management

```ts
type Screen = 'start'|'plan'|'day'|'live'|'arrived'|'exception'|'summary'|'map'|'order'|'add'|'hours';

screen: Screen
checks: [boolean, boolean, boolean]   // shift-open gates
scanned: boolean                      // list intake happened
idx: number                           // current stop index
done: number                          // completed count
sec: number                           // seconds at the current stop
note: string                          // arrival note line
order: number[] | null                // manual override of pending indices
dirty: boolean                        // order was touched manually
detail: number | null                 // stop index shown in the detail sheet
exReason: 0|1|2|3                     // 0 = none picked
exPlan: 0|1|2                         // 1 = retry at end, 2 = drop to tomorrow
alertOpen: boolean
vipFixed: boolean                     // VIP decision made
addPick: 1|2
listOpen: boolean
menuOpen: boolean
```

Stop shape in the prototype: `[name, address, eta, isVip(0|1), serviceMinutes]`. In production this comes from the round API; the derived values the UI needs are: return ETA, savings versus naive order, per-stop ETA, service estimate, VIP window, and the learned parking/contact/history notes shown in the detail sheet. The prototype's penalty numbers (`16:04`, `15:49`, `22 דקות`) are illustrative — they must come from the real re-optimization call.

## Assets

- **Fonts:** Google Fonts — Secular One 400; Heebo 300/400/600/800; IBM Plex Mono 400/600/700. Self-host in production.
- **Icons:** all inline SVG, 24×24 viewBox, `stroke-width` 1.7–2.6, `stroke-linecap: round`, `fill: none`, `currentColor` where possible. Replace with the app's icon set if one exists; keep the stroke weight and size.
- **Map:** the SVG on screen 8 is a hand-built schematic. It is a placeholder for a real map provider. No raster assets are used anywhere in the bundle.
- **Brand:** no Brinks logo files were available. The wordmark is set in Heebo 800 with `.2em` tracking; swap in the official asset.

## Open questions for the client

1. **Map provider** — the map screen needs a real provider (and offline behavior in dead zones).
2. **Shift-manager view** — everything here is the field lead's perspective. Dispatch/manager screens do not exist yet.
3. **Screenshot intake** — the OCR path is designed as instant and confident. Confirm what the failure and partial-read states should look like.
4. **Hours correction** — the note says manual edits are flagged to the shift manager; that approval flow is unspecified.
