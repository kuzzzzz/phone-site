# phone-site

A lightweight static web app for daily encouragement and a quick mood check-in. Mobile-first UI with local cache and optional Google Sheets persistence.

**Live demo:** [phone-vercel-demo.vercel.app](https://phone-vercel-demo.vercel.app)

## Pages

| Page | File | What it does |
|------|------|----------------|
| **Daily Boost** | `index.html` + `app.js` | Reveal positive quotes/links, like/repeat, save, no-repeat cycle, dark mode |
| **Pulse Check** | `pulse.html` + `pulse.js` | Log mood / energy / focus, time-of-day patterns, CSV import/export, save note as boost |
| **Add Boost** | `admin.html` + `admin.js` | Add a quote or a social link (Twitter/X, TikTok, YouTube, Instagram) to the rotation |

## Features

- Random reveal from a flat boost pool (quotes + links)
- Optional **no-repeat** until the pool is exhausted (toggle off for true random)
- Like / Repeat feedback (repeat items get 3× pick weight)
- Save favorites on-device (localStorage, up to 8)
- Copy to clipboard
- Light/dark theme (shared across pages)
- Pulse → “Save note as Boost”
- Offline **outbox**: failed backend writes queue and retry on next load
- Seed migration from `daily_boost_week1.json` once per browser into the sheet

## Architecture

- **Static front-end** (this repo) — deploy on Vercel, Netlify, or GitHub Pages
- **`shared.js`** — API URL, user id, token, `fetchBackendRows` / `postBackend`, theme helpers, offline outbox
- **Google Apps Script + Sheets** — persistent `boost_item`, `boost_feedback`, and `pulse_entry` rows
- **localStorage** — Daily Boost UI state, Pulse entries cache, theme, outbox, seed flag

Backend user id: `phone-site-primary`.

> **Note:** The client ships with an auth token for the Apps Script endpoint. Treat this as a personal tool; anyone with the token can read/write that sheet. Rotating the token and/or proxying writes is recommended before sharing widely.

## Project structure

```
shared.js                 # config + API + outbox + theme
index.html / app.js       # Daily Boost
pulse.html / pulse.js     # Pulse Check
admin.html / admin.js     # Add Boost
styles.css                # shared design system (incl. Pulse)
daily_boost_week1.json    # one-time seed content only
README.md / CHANGELOG.md
```

## Run locally

```bash
python3 -m http.server 4173
```

Open [http://localhost:4173](http://localhost:4173).

Or open any HTML file with VS Code Live Server.

## Deploy

Deploy the repo root as a static site (Vercel / Netlify / GitHub Pages). No build step required.
