# Podcasts

A podcast player built for older adults and people with reduced vision or mobility. It has large text, large touch targets, high-contrast themes and simple navigation. It works on desktop and phone, and is designed to run on a small home server such as a Raspberry Pi.

## Features

- Curated podcast library with grouping by subject (one subject per podcast) and sorting by name or last updated
- Episode list, newest first, and a simple player with big controls, skip back/forward, speed, and a sleep timer
- Favorites, "continue listening", and transcripts when a feed provides them
- Six themes: Cream (default), Light, Dark (gold), Navy, Dark green, High contrast, plus adjustable text size
- Admin page (`/admin`) to add, edit and remove podcasts, and to manage accounts
- Optional accounts so settings, favorites and listening progress sync across devices
- Installable as a PWA

## Requirements

Node.js 20 or newer (developed on Node 24).

## Quick start

```sh
npm install
cp .env.example .env     # then set ADMIN_PASSWORD
npm run dev              # server on :3001, Vite on :5173
```

## Running on a Raspberry Pi

```sh
npm install
npm run build
npm start                # serves the app and API on PORT (default 3001)
```

Keep it running with systemd or a process manager of your choice. Open `http://<pi-address>:3001` from any device on the network.

## Configuration

Set these in `.env`:

| Variable | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | Required to use `/admin`. Change it from the example value. |
| `SESSION_SECRET` | Optional. Signing key for logins. If unset, one is generated into `data/.session-secret`. |
| `PORT` | Server port. Default `3001`. |
| `DATA_FILE` | Podcast list location. Default `data/podcasts.json`. |
| `USERS_FILE` | Accounts location. Default `data/users.json`. |

## Managing podcasts

Open `/admin`, sign in with `ADMIN_PASSWORD`, and add a podcast by its RSS feed URL, with a subject. The list is stored in `data/podcasts.json`, which you can also edit by hand. Feeds are fetched by the server and cached for 15 minutes.

## Optional accounts

Nobody has to sign in. Anyone can create an account from **Sign in** in the header, using a name (3-30 characters) and a password (8+ characters). Signed-in users get theme, text size, view options, favorites and listening progress synced across devices.

- Signing out clears favorites and progress from that device (so a shared device stays private). They remain in the account.
- Sync is last-write-wins for settings and favorites; listening progress keeps the newest position per episode.
- There is no email recovery. The admin can reset a password or remove an account in the **Accounts** section of `/admin`.
- Passwords are stored as salted scrypt hashes in `data/users.json`. Logins last 90 days.

**HTTPS:** over plain HTTP, passwords are not encrypted in transit. That is acceptable on a trusted home network. If the server is reachable from the internet, put it behind HTTPS (for example a Caddy or nginx reverse proxy).

## Data and backups

Everything lives in `data/`: `podcasts.json`, `users.json` and `.session-secret`. Back up this folder. The last two are git-ignored.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Server and Vite dev server together |
| `npm run build` | Typecheck and build the client into `dist/` |
| `npm start` | Run the server (serves `dist/`) |
| `npm test` | Run unit tests |
| `npm run typecheck` | TypeScript check |

## Project layout

- `server/` Express API, feed fetching and parsing, accounts
- `src/` React client (pages, contexts, styles)
- `shared/` types shared by client and server
- `data/` podcast list and account data
