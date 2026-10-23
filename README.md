# getPackd — "Skyscanner for group trips"

Every group departure from Indian operators in one place, compared at a like-for-like **true price**.
Stack: **React (CRA + craco) + Tailwind + Framer Motion** · **Node.js + TypeScript (Express)** · **MongoDB** · NL search via **Claude Sonnet 4.5** (Anthropic API key).

> Operators are **real companies** (the list in `backend/data/operators.json`). Their trips, dates and prices are read from their own websites by `yarn import:trips` and saved in `backend/data/trips.json`, which is seeded on backend start. getPackd does not rate, review or vet these operators, and shows nothing about them that their own site doesn't publish.

---

## Project layout

```
/app
├── backend/
│   ├── src/
│   │   ├── server.ts        # Express app, all routes under /api
│   │   ├── searchEngine.ts  # filters, facets, true price, fit score, ranking
│   │   ├── seedData.ts      # turns the operator list + imported trips into seed records
│   │   ├── destinations.ts  # destinations and the place-name matcher
│   │   ├── utils.ts         # shared helpers: seeded random, rounding, sorting, dates
│   │   └── types.ts
│   │   ├── importTrips.ts   # reads live departures from operators' sites → data/trips.json (runs every 3 days)
│   ├── data/                # operators.json (the operator list), trips.json (latest import)
│   ├── tests/               # API tests (node:test)
│   ├── package.json
│   └── .env                 # MONGO_URL, DB_NAME, ANTHROPIC_API_KEY, ADMIN_*
├── frontend/
│   ├── src/               # pages/, components/, lib/, context/
│   ├── package.json
│   └── .env               # REACT_APP_BACKEND_URL
└── memory/                # PRD.md, test_credentials.md
```

## Environment variables

**backend/.env**

| Key | Example | Notes |
|---|---|---|
| `MONGO_URL` | `mongodb://localhost:27017` | Mongo connection string |
| `DB_NAME` | `test_database` | Database name |
| `CORS_ORIGINS` | `*` | Comma-separated origins |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Only needed for the ✨ natural-language search |
| `NL_MODEL` | `claude-sonnet-4-5-20250929` | Optional. Model used for the natural-language search |
| `PORT` | `8001` | Optional. Port the API listens on |
| `GOOGLE_PLACES_API_KEY` | `AIza...` | Optional. Turns on Google Maps ratings and reviews for operators |
| `TRIPADVISOR_API_KEY` | `ABC123...` | Optional. Turns on Tripadvisor ratings and reviews for operators |
| `TRIPADVISOR_REFERER` | `https://getpackd.example` | Optional. Only if the Tripadvisor key is limited to a domain |
| `ADMIN_USERNAME` | `admin` | `/admin` page login |
| `ADMIN_PASSWORD` | `wayfind2026` | `/admin` page login |

**frontend/.env**

| Key | Example |
|---|---|
| `REACT_APP_BACKEND_URL` | `http://localhost:8001` (local) or your preview URL (Studio) |

The frontend always calls `${REACT_APP_BACKEND_URL}/api/...`. Do **not** add `/api` to the variable.

---

## Option A — Run in Emergent Studio (preview environment)

> **Note:** the Studio image starts the backend with `uvicorn server:app` (Python). The backend is now Node.js/TypeScript, so the supervisor `backend` program must be changed to run `yarn start` (after `yarn install && yarn build`) in `/app/backend`, and `ANTHROPIC_API_KEY` must be set, because the Emergent LLM key only works through the Python `emergentintegrations` package.

- Services are managed by **supervisor**: backend on `0.0.0.0:8001`, frontend on `3000`, MongoDB local.
- The ingress sends `/api/*` → backend (8001) and everything else → frontend (3000).
- `frontend/.env` → `REACT_APP_BACKEND_URL` is the public preview URL (e.g. `https://<app>.preview.emergentagent.com`). Don't change it.
- Hot reload is on for both services. Code edits apply automatically.

Useful commands (Studio terminal):

```bash
sudo supervisorctl status                 # see what's running
sudo supervisorctl restart backend        # after editing backend/.env or adding yarn packages
sudo supervisorctl restart frontend       # after editing frontend/.env or adding yarn packages
tail -n 100 /var/log/supervisor/backend.err.log    # backend errors
tail -n 100 /var/log/supervisor/frontend.out.log   # frontend build output
```

Adding dependencies in Studio:

```bash
cd /app/backend && yarn add <pkg>
cd /app/frontend && yarn add <pkg>        # always yarn, never npm
```

Open the app at the preview URL. Admin is at `/admin` (admin / wayfind2026).

---

## Option B — Run locally (your own machine)

### 1. Prerequisites
- **Node.js 20+** and **Yarn 1.x** (`npm i -g yarn` once, then use only yarn)
- **MongoDB 6+** running locally, or a MongoDB Atlas URL
  - Docker shortcut: `docker run -d --name wayfind-mongo -p 27017:27017 mongo:7`

### 2. Backend

```bash
cd backend
yarn install
```

Create/edit `backend/.env`:

```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="wayfind"
CORS_ORIGINS="http://localhost:3000"
ANTHROPIC_API_KEY=<your Anthropic API key>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=wayfind2026
```

Start it:

```bash
yarn dev            # http://localhost:8001, restarts on file changes
```

On first start it seeds the operators and the imported trips from `backend/data/`.
Check it at http://localhost:8001/api/, which should return `{"message":"getPackd API","departures":...}`.

### 3. Frontend

```bash
cd frontend
yarn install
```

Set `frontend/.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

> Remove or ignore the `WDS_SOCKET_PORT=443` line locally. It's only for the Studio HTTPS proxy and can break hot reload on localhost.

Start it:

```bash
yarn start
```

Open http://localhost:3000.

### 4. Production build (optional)

```bash
cd frontend && yarn build          # outputs frontend/build (serve as static files)
cd backend && yarn build && yarn start   # compiles to backend/dist and runs it on port 8001
```

Put both behind one domain with a reverse proxy routing `/api/*` → backend:8001 and everything else → the static build. Otherwise set `REACT_APP_BACKEND_URL` to the API's public URL before `yarn build`.

---

## Local vs Studio at a glance

| | Emergent Studio | Local |
|---|---|---|
| Start services | Already running (supervisor) | `yarn dev` (backend) + `yarn start` (frontend) |
| Restart | `sudo supervisorctl restart backend/frontend` | Ctrl+C and re-run (`yarn dev` restarts on changes) |
| MongoDB | Pre-installed, `mongodb://localhost:27017` | Install yourself / Docker / Atlas |
| `REACT_APP_BACKEND_URL` | Public preview URL | `http://localhost:8001` |
| `/api` routing | Kubernetes ingress | Direct to port 8001 (CORS enabled) |
| Backend deps | `cd backend && yarn install` | `cd backend && yarn install` |
| LLM key | Add `ANTHROPIC_API_KEY` to `backend/.env` | Add `ANTHROPIC_API_KEY` to `backend/.env` |
| Logs | `/var/log/supervisor/*.log` | Your terminal |

---

## Common tasks

- **Trips refresh by themselves every 3 days.** While the backend is running it re-reads every supported operator's site on a schedule, so new trips, dates and prices appear without any manual step. If the backend was switched off when a refresh fell due, it runs about a minute after the next start. `IMPORT_EVERY_DAYS` in `backend/.env` changes the gap (`0` turns it off). The admin page shows when trips were last read, when the next refresh is, what the last one found, and has a **Refresh now** button. To run it by hand instead: `cd backend && yarn import:trips`, then restart the backend.
  - An operator whose site can't be reached keeps its trips from the previous run (minus dates that have passed).
  - If a run comes back with far fewer trips than before (the network was down, say), the previous data is kept and it tries again 6 hours later.
  - Leads, alerts, shortlists and anything added in the admin page are never touched.
- **Instagram follower counts:** shown beside the operator's name wherever a trip is listed, as a sign of audience size (not a rating), with the date and source of the figure. Only handles linked from the operator's own website are used. Instagram's website is never read (it needs a login and its terms forbid automated collection); the figures come from one of:
  - *Qoruz* (default): a public influencer-analytics directory that lists follower counts by handle. Its coverage is partial and some of its profiles are years old, so only figures it captured in the last 400 days are kept.
  - *Instagram's official Business Discovery API*, used instead when `IG_USER_ID` and `IG_ACCESS_TOKEN` are set in `backend/.env` (needs an Instagram professional account linked to a Facebook Page, a Meta developer app with Facebook Login for Business, and a token with `instagram_basic`, `instagram_manage_insights`, `pages_show_list` and `pages_read_engagement`). It covers every Business or Creator account and is always current. An extended user token lasts 60 days; when it lapses the lookups fail and the last figures are kept, so renew it in the Graph API Explorer and replace `IG_ACCESS_TOKEN`.
  - *By hand*: add `"instagram_followers": 48200` to an operator's row in `backend/data/operators.json` for any the above miss.

  The counts are re-read with the scheduled trip refresh when they are more than a week old; `cd backend && yarn import:instagram` re-reads them on demand.
- **Google Maps and Tripadvisor ratings:** shown beside the operator's name on trip cards, trip pages and the operators list, with up to 5 reviews from each site under "What travellers say" on the operator's page. Every rating and review links back to its listing and is credited to its site and author. Neither site is scraped (both forbid it); their official APIs are used, each switched on by its key in `backend/.env`:
  - *Google*: create a project in Google Cloud, turn on **Places API (New)** and billing, and create an API key restricted to that API. Set it as `GOOGLE_PLACES_API_KEY`. Reviews come from the Place Details "Atmosphere" fields, so check the current price per call; about 100 operators a week is a few hundred calls a month.
  - *Tripadvisor*: sign up for the **Content API** at tripadvisor.com/developers, and add your server's IP address (or domain, plus `TRIPADVISOR_REFERER`) to the key's allowed list. Set it as `TRIPADVISOR_API_KEY`.
  - A listing is used only when it links to the operator's own website, so a similarly named business is never picked up. For an operator the search misses, add `"google_place_id": "ChIJ..."` or `"tripadvisor_id": "1234567"` to its row in `backend/data/operators.json`.
  - Ratings are re-read with the scheduled trip refresh when they are more than a week old; `cd backend && yarn import:reviews` re-reads them on demand, then restart the backend. If a listing can't be read, its last figure is kept for up to 30 days (Google limits how long its content may be stored), then dropped.
  - These are the sites' ratings, not getPackd's; they don't change the order of results.
- **Which operators have trips:** the importer has a reader per site in `backend/src/importTrips.ts` (`SOURCES`). Operators without a reader are still listed, with a link to their website and no departures. To add one, write a `discover()` (trip page URLs) and a `read()` (title, dates, price from the page) for it, then try it with `cd backend && yarn import:trips <operator-id>`: that lists every trip it found and any it skipped for having no known destination, without saving anything.
- **What is shown for imported trips:** title, photo, dates, listed price, seats (where published), and the operator's own inclusion/exclusion lists. The only amount ever added to a listed price is 5% GST when the operator says GST is extra. getPackd's own ratings and reviews, group make-up and verification are left empty (Google and Tripadvisor ratings are shown separately, above).
- **Admin:** `/admin` → log in → add operators, trips (plus first departure) and departures, verify operators, view leads and operator signups.
- **Run backend tests:** start the backend, then `cd backend && REACT_APP_BACKEND_URL=http://localhost:8001 yarn test`. Without that variable, the tests hit the Studio preview URL.
- **Key API endpoints:** `GET /api/search?...` (all filters, comma-separated multi values), `GET /api/home`, `GET /api/meta`, `GET /api/trips/{id}`, `GET /api/operators/{id}`, `GET /api/compare?deps=a,b`, `POST /api/leads`, `POST /api/alerts`, `POST /api/shortlists`, `POST /api/nl-search`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Frontend shows no trips / network errors | Check `REACT_APP_BACKEND_URL` (no trailing `/api`), restart the frontend after editing `.env` |
| `Missing required environment variable: MONGO_URL` on backend start | `backend/.env` missing or not in the `backend/` folder |
| ✨ AI search returns an error | `ANTHROPIC_API_KEY` missing/invalid, or the account is out of credit |
| CORS error locally | Set `CORS_ORIGINS="http://localhost:3000"` (or `*`) and restart the backend |
| Globe/map not drawing | Needs internet access to load `world-atlas` from jsDelivr CDN |
