repo: eladedri22700-ai/flofer-brinks
branch: main
path: frontend/src

## Last sync
date: 2026-09-03T18:40:00Z

### Updated in this project
- Redesigned the full field flow as one interactive prototype: shift start → list intake → day timeline → driving → arrival → exception → close.
- Added screens the repo did not have: shift-open checks, stop detail, exception report, add-stop impact check, VIP-window alert, schematic route map, manual reorder, weekly hours.
- Documented the visual language (Ink / Brass / Done / Exception, Secular One + Heebo + IBM Plex Mono, action sizes and rules) in `FLOFER System.dc.html`.
- Kept three earlier visual directions in `FLOFER Directions.dc.html` for reference.

## Screen map
| Project screen | Repo files |
| --- | --- |
| Prototype — פתיחת משמרת | (new; no repo equivalent) |
| Prototype — תכנון / רשימת היום | frontend/src/pages/RoutePage.tsx, components/route/* |
| Prototype — היום (ציר) | frontend/src/pages/DashboardPage.tsx, DashboardPage.module.css |
| Prototype — נהיגה / הגעתי | frontend/src/pages/LivePage.module.css, components/live/NextStopHud.tsx |
| Prototype — חריג, פרטי עצירה, הוספת עצירה, מפה, סדר, שעות | (new; extend RoutePage / LivePage) |
| Prototype — סגירת סבב | frontend/src/pages/DashboardPage.tsx |
| Bottom nav | frontend/src/components/layout/BottomNav.tsx, BottomNav.module.css |
| Design system page | frontend/src/styles/tokens.css, global.css, components/ui/Button.module.css, Card.module.css |
