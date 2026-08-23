# Phone Site — Change Log

A lightweight development log for tracking changes, bugs, rewrites, and architectural decisions.

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
