# Phone Site — Change Log

A lightweight development log for tracking changes, bugs, rewrites, and architectural decisions.

## 2026-08-25

### Fixed
- **No-repeat toggle:** `pickItem()` now respects `state.noRepeat`. When off, picks are true random and views are not recorded against the cycle list.
- **Feedback map:** when multiple `boost_feedback` rows exist for the same item, the client keeps the one with the latest `updatedAt` instead of last-in-array only.

### Changed
- Extracted **`shared.js`**: `API_URL`, `USER_ID`, `AUTH_TOKEN`, `newId` / `hashId`, `fetchBackendRows`, `postBackend` (checks response / `ok`), shared dark-mode helpers, and an offline **outbox** that retries failed POSTs on load.
- Daily Boost shows **“Loading boosts…”** until the pool is ready; status messages use a simple priority so cycle-complete is not immediately overwritten.
- **Pulse Check** restyled onto shared `styles.css` (gradient glass, nav, dark mode, history link). Pulse-specific chart/slider styles live in the same stylesheet.
- `.history-link` styles defined once in CSS (Boost / Admin / Pulse).
- README updated to match current pages, architecture, and seed vs live content.

### Data / Architecture
- Boost UI state (`currentItem`, `savedMessages`, `viewedIds`, etc.) remains **localStorage only** — there is no remote `boost_state` write path in current code. Earlier CHANGELOG notes about `boost_state` rows on every reveal referred to a prior design and no longer apply.
- Feedback and items still append rows on the sheet; client-side latest-by-`updatedAt` soft-upserts feedback in memory. Server-side upsert is still a desirable follow-up.

### Known / Next
- Auth token remains in client JS (intentional deferral); rotate / proxy before wider sharing.
- Seed migration still POSTs one request per new seed item (~84 on first browser) — batching not yet built.
- Considering batched Daily Boost delivery (set per day/week) instead of one-at-a-time through the full pool.

## 2026-08-23 (later)

### Changed
- Daily Boost content moved off the weekday-keyed `daily_boost_week1.json` structure entirely. Content now lives as `boost_item` rows in the same Google Sheet (`Phone Site Database`) that Pulse Check already writes to, reusing the existing generic Apps Script endpoint — no backend script changes required.
- Reveal picker is now a flat pool with no-repeat-until-exhausted logic (previously artificially capped at 12 items/day).
- Added three intake paths for new Daily Boost content: a new **Add Boost** page (quote+author, or a link with auto-detected platform from Twitter/TikTok/YouTube/Instagram URLs), a **"Save note as Boost"** button on Pulse Check, and bulk import (as done for the original 84-quote seed).
- Added Like and Repeat feedback per item (`boost_feedback` rows). Repeat-marked items are exempt from no-repeat exclusion and get 3x pick weight so they resurface, with a "shown N× since [date]" stat shown under the item.
- Added a delete/remove control on each saved message in the Saved list.

### Fixed
- **Seed migration bug:** local JSON quotes only migrated into the sheet if the pool was completely empty on load, so adding even one item via Add Boost/Pulse before ever opening Daily Boost silently skipped seeding the other ~82. Migration now runs once per browser based on a stored flag, and merges into the pool instead of replacing it.
- **Watch button showing with no link:** `.boost-link` had an unconditional `display: inline-block`, which overrode the `[hidden]` attribute's default `display: none` at equal CSS specificity (author styles beat the UA stylesheet). The button was always visible regardless of `hidden`, so clicking it with no real `href` set just jumped to `#` on the same page. Added an explicit `.boost-link[hidden] { display: none; }` rule. Also added a small "🎥 Watch this daily boost" label that only shows alongside a real link.

### Known / Next
- Considering batching Daily Boost delivery (e.g. a set released per day/week) instead of one-at-a-time rotation through the full pool — under discussion, not yet built.
- `boost_state` rows are still written on every reveal/save/toggle, same as the original known issue below — still unaddressed.

## 2026-08-23

### Fixed
- Fixed Daily Boost JavaScript initialization order. `initialState` is now defined before `loadState()` is called.
- Restored the Reveal, Copy, Save, No Repeat, and Dark Mode controls after the initialization error stopped `app.js` from executing.

### Changed
- Daily Boost content is loaded from `daily_boost_week1.json` rather than being embedded directly in the JavaScript.
- Daily Boost entries support an optional `author` field. The author is displayed only when present.
- Daily Boost state is synchronized with the Google Apps Script / Google Sheets backend.
- Pulse Check and Daily Boost now share the same Phone Site navigation.
- Navigation was simplified to normal document flow to avoid mobile layout conflicts.

### Data / Architecture
- GitHub is used for static Daily Boost content.
- Google Sheets is used for persistent user state and history.
- Browser `localStorage` remains a local cache/fallback for Daily Boost state.
- The backend user identifier currently used by Phone Site is `phone-site-primary`.

### Known / Next
- Migrate historical Pulse Check entries into the Google Sheets backend.
- Review the backend state model so repeated Daily Boost state writes do not create unnecessary duplicate rows.
- Continue recording significant UI rewrites and production bugs here.

---

## Log format

For future changes, record:

- **Date**
- **Changed** — what was intentionally modified
- **Fixed** — bugs/errors resolved
- **Data / Architecture** — persistence, API, schema, or structural changes
- **Known / Next** — unresolved issues or planned follow-up
