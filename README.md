# RabbitTracker

Self-hosted web app for a household or small rescue to track the health of their rabbits. Phone-first
for quick logging, laptop-friendly for reviewing history. Admins see and control everything, while
workers (foster carers) only see the bunnies assigned to them.

Built with Express 5 + Postgres 16 + Drizzle on the server and a dependency-free vanilla TypeScript
SPA on the client. Ships as a two-container Docker Compose stack with persistent volumes.

| Home | Bunnies | Bunny profile |
| --- | --- | --- |
| ![Home dashboard](docs/screenshots/home.jpg) | ![Bunny list](docs/screenshots/bunnies.jpg) | ![Bunny profile](docs/screenshots/rabbit.jpg) |

| Calendar | Settings | Health checklist editor |
| --- | --- | --- |
| ![Calendar](docs/screenshots/calendar.jpg) | ![Settings](docs/screenshots/settings.jpg) | ![Checklist editor](docs/screenshots/checklist.jpg) |

| Vets & clinics | Lists | Sign in |
| --- | --- | --- |
| ![Vets and clinics](docs/screenshots/vets.jpg) | ![Managed lists](docs/screenshots/lookups.jpg) | ![PIN sign in](docs/screenshots/login.jpg) |

Desktop:

![Home dashboard on desktop](docs/screenshots/desktop-home.jpg)

## Features

**Bunnies**
- Profiles with name, sex, breed, colour, date of birth, desexed, microchip, avatar, notes, status
  (active / deceased) and memorial details (date and reason).
- Quarantine flag with a release date, target weight range and a feeding plan.
- Bonded-bunny links (symmetric) shown on each profile.
- Photo gallery per bunny, combining check photos and journal photos.

**Health**
- Health checks with weight, appetite, droppings, energy, body condition (1–5), temperature,
  pain score (0–10), vet notes and a photo.
- The RRR weekly health checklist (posture, demeanour, eyes, breathing, coat & skin, behaviour,
  bum, ears, nails, genitals, hocks) with tick-button answers, per-section notes and example
  photos. The checklist itself is editable in Settings.
- Quick log — tick any checklist item from the bunny page and save it as a health check without
  the full form.
- Manual weigh-ins with a one-tap "Log weight" action.
- Weight trend chart with loss alerts and target-range checks.
- Timestamped notes & photos journal per bunny.

**Care & treatment**
- Treatments with dose, route, frequency, reason, dates and status, plus a drug cabinet with stock
  batches, expiry, reorder levels and automatic FEFO stock deduction.
- Vaccinations with next-due tracking (default booster intervals from the vaccine-type list).
- Routine care schedules (nails, teeth, grooming, or your own care types) with dated records and
  due/overdue badges.
- Vet appointments with status, cost, follow-up date and optional ICS/webcal calendar sync.
- Vets and clinics directory, with inline "add new" popups in the appointment and vaccination
  forms so you never leave the form.
- Managed lists for breeds, colours, visit types, locations, vaccine types, treatment
  routes/frequencies/reasons, care types, FAQ categories and suppliers.

**Household & admin**
- Admins sign in with username and password; workers sign in with a personal PIN and only see the
  bunnies assigned to them.
- Per-worker permissions (record health data, edit profiles, add their own bunnies, view costs,
  manage calendars, edit the FAQ).
- Admin-only user management, checklist editor, vet/clinic directory and list editor.
- Home dashboard stats: in care, needing attention, appointments (14 days), active treatments and
  quarantine.
- Export health checks CSV, appointments CSV and a full JSON backup.
- Demo mode — a Settings switch that loads sample bunnies, records, appointments (dated around the
  current month), journal entries, bonds, a vet and a clinic, and removes every demo row when
  switched off.
- Installable PWA with light and dark themes.

## Quick start (Docker)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine with
the Compose plugin). No other dependencies.

```sh
git clone https://github.com/<your-account>/rabbittracker.git
cd rabbittracker
cp .env.example .env      # optional — sensible defaults are built in
docker compose up -d --build
```

Open <http://localhost:8091>. On first run the app asks you to create the first admin account
(username + password). Add workers from **Users**; each worker gets a unique 4–8 digit PIN.

The stack is two containers:

- `db` — Postgres 16, data in the `rt_db` volume, bound to `127.0.0.1:5434` on the host.
- `app` — the Node server (migrations run on boot), photos in the `rt_data` volume, published on
  `APP_PORT` (default `8091`). It has a healthcheck against `/api/health`.

To update after pulling changes:

```sh
docker compose up -d --build
```

To stop, or to wipe everything (including data):

```sh
docker compose down          # stop, keep volumes
docker compose down -v       # stop and DELETE the database and photos
```

Logs and status:

```sh
docker compose ps
docker compose logs -f app
```

### Environment variables

Copy `.env.example` to `.env` to override any of these (all optional):

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_PORT` | `8091` | Host port the app is published on. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `rabbittracker` | Database credentials for the bundled Postgres. |
| `COOKIE_SECURE` | `false` | Set to `true` only when serving over HTTPS, otherwise login breaks on plain HTTP. |
| `SESSION_IDLE_MINUTES` | `30` | Idle lock and server-side idle session expiry. |
| `SESSION_TTL_MINUTES` | `10080` | Absolute session lifetime (7 days). |
| `DATA_DIR` | `/data` in Docker, `./data` locally | Where uploaded photos are stored. |
| `DATABASE_URL` | built from the Postgres variables | Override to point at an external Postgres. |

For phone access from outside the LAN, put the machine on [Tailscale](https://tailscale.com) and
open `http://<machine-name>:8091` from the phone.

## Sign-in and roles

- **Admins** sign in with username and password and see every bunny. They manage users, lists, the
  checklist, vets/clinics and exports. An admin can set a personal PIN in **Settings → Account**
  for quick sign-in on a shared device.
- **Workers** sign in with a personal 4–8 digit PIN and only see bunnies assigned to them (assign
  carers from a bunny's page). Their permissions are ticked per worker in **Users**: record health
  data, edit bunny profiles, add their own bunnies, view costs, manage calendar sync, edit the FAQ.
  A worker with "add their own bunnies" is assigned automatically when they create one.

## Demo data

**Settings → Demo data** loads a full sample dataset: three bunnies with weight history, checklist
answers, temperatures and pain scores, treatments, vaccinations, care schedules, appointments
placed around the current month, journal entries, bonded pairs, plus a clinic and a vet. Switch it
off to delete every demo row — your own data is untouched. Handy for trying the app or taking
screenshots.

## Local development

```sh
docker compose up -d db     # Postgres only, on host port 5434
npm install
npm run dev                 # server on 8091 + Vite client on 5174
```

- Client dev server: <http://localhost:5174> (proxies `/api` to `8091`).
- API/server: <http://localhost:8091> (migrations run on boot).
- Data dir for photos defaults to `./data` locally.

Commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Server + Vite client with watch mode. |
| `npm run typecheck` | `tsc` for server and client. |
| `npm run test` | Vitest unit suites (pure logic, validation, mappers). |
| `npm run build` | Typecheck + client production build. |
| `npm run db:generate` | Generate a SQL migration from schema changes. |

On Windows PowerShell use `npm.cmd` (the `npm.ps1` shim is blocked by default).

## Data and backups

- Postgres data lives in the `rt_db` volume; photos live in the `rt_data` volume. Back up volumes,
  not containers — or use **Settings → Export → JSON backup** for a portable dump.
- Weight is stored as integer grams and money as integer cents; temperatures as tenths of a degree.
  No floats in the database.
- Migrations are committed under `server/drizzle/` and applied automatically at boot.

## Project layout

```
client/    Vite SPA — pages, components, design system (no runtime dependencies)
server/    Express API — routes, Drizzle schema, services, seeds, migrations
shared/    Types and pure logic shared by both (health math, checklists, drug dosing)
docs/      Screenshots used in this README
```
