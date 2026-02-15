# phone-site

A lightweight static web app that reveals positive messages with a modern mobile-first UI.

## Features

- Random message reveal
- Optional no-repeat mode (shows every message once before recycling)
- Save favorite messages to local storage
- One-click copy to clipboard
- Light/dark theme toggle persisted in browser storage
- Accessible semantics and keyboard focus support

## Run locally

Because this is a static site, any local web server works.

### Option 1: Python

```bash
python3 -m http.server 4173
```

Then open: <http://localhost:4173>

### Option 2: VS Code Live Server

Open `index.html` with Live Server.

## Project structure

- `index.html` – page structure and app controls
- `styles.css` – visual styles, responsive layout, reduced-motion support
- `app.js` – reveal logic, state persistence, saved/copy/theme behaviors

## Deploy

Deploy as a static site on Vercel, Netlify, or GitHub Pages.
