# Field-flow redesign — implementation handoff (for Cursor / whoever continues this)

This folder documents a redesign implemented by Claude Code across three merges to
`main`. It is **not** a separate app — it's real code, already live in this repo,
wired to the real backend. This file exists so a fresh session (human or AI) can
find its way around without re-deriving everything from the diffs.

## Where the original design comes from

`DESIGN_SPEC_ORIGINAL.md` in this folder is the **unmodified** design-handoff README
that came out of Claude Design (claude.ai/design). It is the full spec: exact colors,
type sizes, spacing, the 11 screens + 4 overlays, binding rules, state machine. Treat
it as the source of truth for "what the design intends." `DESIGN_SCREEN_MAP_ORIGINAL.md`
is the design tool's own (rough, not fully accurate) guess at which repo files each
screen maps to — useful as a hint, not gospel; the real mapping is the table below,
written after actually reading this codebase.

The original bundle also included two `.dc.html` files (`FLOFER Prototype.dc.html`,
`FLOFER System.dc.html`) — an interactive HTML/JS prototype and a design-system
reference page. Those were **not** copied into this repo (they're single-file mockups
full of design-tool framework code, not something to run or import) — everything
useful from them is already distilled into `DESIGN_SPEC_ORIGINAL.md` and into the
real components listed below. If you need the raw prototype files for a pixel-level
check, ask the person who ran the original Claude Design session for the export
bundle.

## Merge history (chronological, on `main`)

1. **`Implement FLOFER field-flow redesign (Claude Design handoff)`** — the main
   redesign: new screens, rebuilt Day/Live/Route screens, shared overlays.
2. **`Fix bugs found by running the app end-to-end`** — three real bugs found by
   actually running the app in a browser (not just typecheck/build): RTL/LTR text
   bugs and a duplicated string. Small diff, same PR body has the details.
3. **`Polish brand identity, login screen and global app shell`** — logo, login
   screen, and the app-wide background/brand-bar, done in a follow-up round because
   the first pass only touched screen content, not the surrounding chrome.

Read each merge commit's own message (`git log --grep redesign` or just `git log
main`) — they're intentionally detailed and explain the *why* behind non-obvious
choices, not just the *what*.

## Screen → file map (as actually implemented, not as originally guessed)

| Design screen | Route | Real file(s) |
| --- | --- | --- |
| 1. פתיחת משמרת (shift-open) | `/app/start` | `pages/StartPage.tsx` — **new**. Client-only gate (see "Known simplifications" below) via `lib/shiftChecks.ts`. |
| 2. תכנון / רשימת היום | `/app/plan` | `pages/PlanPage.tsx` — **not rebuilt**, only reused as-is. It's a much richer real feature (OCR, saved customers, VIP/time-window editing) than the mockup's 3 tiles; gutting it to match the mockup would have been a regression. Lowest-priority item left if more design fidelity is wanted here. |
| 3. היום (day timeline) | `/app/dashboard` | `pages/DashboardPage.tsx` (rewritten, now thin) + `components/dashboard/DayRound.tsx` (**new** — the hero/rail/timeline). Old `TodayRoundPanel`, `RoundPulse`, `DailyStartCard`, `HoursReportsCard` were deleted (superseded). |
| 4/5/6. נהיגה / הגעתי / חריג (driving / arrived / exception) | `/app/live` | `pages/LivePage.tsx` — rewritten in place. All three design screens live in this **one** component as sub-states of `current.status` (`pending` = driving, `arrived` = arrived) plus a local `exceptionOpen` overlay. All the pre-existing real-time plumbing (geofencing, wake lock, offline queue, lock-screen notifications, reoptimize proposals, SOS) is untouched — only the render layer and a few new mutations were added. |
| 7. סגירת סבב (summary) | `/app/summary/:id?` | `pages/SummaryPage.tsx` — light touch only (copy + a couple of tokens); it already rendered real data well. |
| 8. מפת הסבב (map) | `/app/board` | `pages/BoardPage.tsx` + `components/map/RoundMap.tsx` — **not rebuilt**. Important: the design's own spec explicitly says its schematic SVG map is a placeholder for "a real map provider" — this repo already has one (real Google Maps via `RoundMap.tsx`), so keeping it as-is *is* the correct fidelity call, not a shortcut. |
| 9. סדר הנקודות (manual reorder) | `/app/route` | `pages/RoutePage.tsx` — rewritten as a chrome-free, pending-stops-only list matching the mockup's visual language, keeping the existing (better-than-mockup) drag-to-reorder via `@dnd-kit` instead of switching to up/down buttons. |
| 10. הוספת עצירה (add-stop) | `/app/add-stop` | `pages/AddStopPage.tsx` — **new**. Uses the real `what-if` backend endpoint for a genuine impact preview (added minutes, new return ETA, deadline warning), replacing the old `window.confirm()` flow in `PlanPage`. |
| 11. שעות עבודה (hours) | `/app/hours` | `pages/HoursPage.tsx` — **new**, extracted out of what used to be a collapsible section inside `DashboardPage`. |
| Overlay A: פרטי עצירה (stop detail) | mounted globally | `components/overlays/StopDetailSheet.tsx` |
| Overlay B: VIP-window-at-risk | inside Live | Banner + dialog inline in `pages/LivePage.tsx` (`vipRisk` / `vipDialogStop`) |
| Overlay C: כל הסבב (full round) | mounted globally | `components/overlays/FullRoundSheet.tsx` |
| Overlay D: עוד (more menu) | mounted globally | `components/layout/MoreSheet.tsx` — **not rebuilt**, extended. It already had real settings/legal/logout functionality the mockup doesn't know about; new entries (הוספת עצירה, שעות עבודה, כל הסבב) were added to the existing list rather than replacing it. |

## Shared infrastructure added

- `styles/tokens.css` — a block of `--field-*` custom properties (Ink/Brass/Done/
  Exception palette, fonts, radii, shadows). These are **fixed brand values**,
  deliberately kept separate from the app's existing theme-adaptive tokens
  (`--surface-*`, `--text-*`, etc. — those still respond to light/dark mode
  elsewhere in the app). Anything under `--field-*` should not vary by theme.
- `store/chromeStore.ts` — one boolean (`drivingLocked`), set by `LivePage` via
  `useLayoutEffect`, read by `AppLayout` to hide bottom-nav/brand-bar/HUD while a
  stop is actively being driven to / worked at (binding rule: driving mode has no
  nav, two actions only). `AppLayout.tsx` also hides chrome by path prefix for the
  other "immersive" screens (`/app/board`, `/app/route`, `/app/hours`,
  `/app/add-stop`, `/app/start`) — see `IMMERSIVE_PREFIXES` there.
- `store/overlayStore.ts` — `detailStopId` / `fullListOpen`, so any screen can open
  the shared stop-detail or full-round sheet without prop-drilling. Both sheets are
  mounted once in `AppLayout.tsx`, next to `MoreSheet`.
- `lib/shiftChecks.ts` — localStorage-only, per-user-per-day. See below.
- `lib/roundBrief.ts` — gained `isVipAtRisk` / `firstVipAtRisk` (real computation:
  a VIP stop's ETA vs. its `tw_end`, not a fabricated flag).

## Known simplifications (deliberate, not oversights — read before "fixing")

- **Shift-open checks (`/app/start`) are client-only**, not persisted server-side.
  The backend has no vehicle/team/comms-check fields at all. If this needs to be a
  real audited checklist, that's a backend schema change first.
- **VIP dialog's "if we move it earlier" tile doesn't show a fabricated preview
  number.** Computing a real one would need a speculative reorder call just to
  preview; instead the primary button performs a *real* reorder (swaps the VIP
  stop one position earlier via `reorderManual`) and the UI updates from the real
  result. No pretend numbers.
- **Stop-detail sheet has no 5-visit service-time bar chart.** The mockup's chart
  needs per-visit history that no endpoint currently returns. Shown instead: the
  real `service_duration_min` + `service_estimate_source` (learned/default) +
  `learned_badge` already on `StopDto`.
- **Exception report's "retry at end of round"** completes the original stop (with
  the chosen exception code, for the record) and re-adds it as a **new** stop via
  `addStop` at the end of the queue — there is no status transition back to
  "pending" in the backend, so this is the closest real equivalent to "come back to
  it later today." This means it will show up as a second, separate stop record
  (double-counted in per-address stats) — flagging this in case that's ever
  surprising in analytics.
- **`PlanPage`, `BoardPage`, `MoreSheet` were deliberately not rewritten** — see the
  table above. Don't treat their more "generic app" visual style as an oversight;
  gutting their real functionality to match the mockup's simplified version would
  have been a regression, not fidelity.

## If you want to go further

Natural next steps, roughly in order of value:
1. Visual pass on `PlanPage` to bring its chrome in line with the `--field-*`
   system (currently untouched — see table above).
2. A real backend field for shift-open checks, if the business wants that audited
   rather than client-local.
3. Re-check the "retry at end of round" double-stop behavior against real usage —
   decide if it needs a dedicated backend concept instead of the addStop workaround.

## Verifying changes

```bash
cd frontend
npm install
npx tsc --noEmit
npx vite build
npx vitest run
```

For a real end-to-end check (not just build), run the actual stack locally: Postgres
+ the FastAPI backend (`backend/README`-equivalent instructions are in the repo
root `README.md`) + `npm run dev`, then click through it in a browser. Static
checks did not catch the three bugs fixed in commit 2 above — only actually running
the app did.
