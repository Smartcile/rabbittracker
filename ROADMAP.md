# Roadmap

## Done (v0.1)

- [x] **M1 — Scaffold + auth.** Repo, tooling, Docker Compose, Drizzle migrations, first-run admin
      setup, login/logout, sessions with sliding expiry and idle lock, dark app shell.
- [x] **M2 — Rabbits.** CRUD, rabbit modal, profile page, avatar upload, bunnies list, settings
      management.
- [x] **M3 — Health checks + weight math.** Checks CRUD with photos, weight trend chart and
      alerts, home quick-log, history page.
- [x] **M4 — Care, vaccinations, treatments + attention badges.**
- [x] **M5 — Appointments + calendar sync.**
- [x] **M6 — FAQ + export + polish.**
- [x] **M7 — Drug cabinet.** Editable reference of common rabbit medicines (seeded once), stock
      batches with expiry and reorder levels, weight-based dose calculation, treatment linking
      with per-dose medication logging and automatic stock deduction, and active treatments shown
      on the calendar.
- [x] **Daily checks, medication log + calendar events.** Configurable daily check types (poo,
      water, food, …) logged per bunny, medication dose logs linked to treatments/drugs (doses
      deduct from stock FEFO), and user calendar events with types and simple recurrence, with
      daily checks and active medication courses shown on the calendar.
- [x] **M8 — Admins and workers.** Per-user PIN sign-in, admin user management, per-worker
      permissions, bunny assignment via `rabbit_carers`, worker-scoped data and hidden costs,
      admin carer assignment UI.
- [x] **Calendar subscriptions** — internal subscribable ICS feed (all bunnies or per rabbit) and
      multiple named external calendar subscriptions.
- [x] **Demo mode.** Settings switch that seeds sample bunnies and records with appointments
      around the current month, and removes every demo row when switched off.
- [x] **RRR weekly checklist + quick logging.** Editable checklist sections/answers with example
      photos, quick-log card for individual findings, manual weigh-ins, and a timestamped
      notes & photos journal per bunny.
- [x] **Vet directory + button toggles.** Saved vets feed appointment/vaccination dropdowns with
      inline creation, and every checkbox in the UI is now a tap-friendly toggle button.
- [x] **Managed lists + clinics.** Generic option lists (breeds, colours, visit types, locations,
      vaccine types, treatment routes/frequencies/reasons, care types, FAQ categories, suppliers)
      with inline creation, clinics split out from vets, and supplier tracking on drug batches.
- [x] **Bunny powerhouse batch 1.** Quarantine flag with release date, target weight range,
      feeding plan, memorial details (date/reason), temperature and pain score on checks, bonded
      bunny links, per-bunny photo gallery, and a home dashboard stat row.

## Planned features (agreed but not built)

These are queued from the "bunny powerhouse" list; pick them up in any order.

**Rescue workflow**
- [ ] **Intake & adoption records** — intake date/source, surrender reason, adoption date, status
      (intake → foster → adopted → sanctuary), plus an **adopter directory** (contacts,
      applications, matched bunny).
- [ ] **Foster placements** — assign a bunny to a worker with start/end dates and handover notes,
      with placement history per bunny.
- [ ] **Bonding session tracker** — log introduction sessions between two bunnies over days with
      outcomes (bonded links already exist; this adds the session log).
- [ ] **Litter/kindling records** — expected date, kit counts and outcomes for pregnant rescues.
- [ ] **Public adoption page** — shareable read-only bunny profile link for listings.

**Health & medical**
- [ ] **Medication due-dose checklist** — per-day doses generated from active treatments with
      tick-off, so meds are never missed.
- [ ] **Symptom episodes** — track an episode (e.g. gut stasis) separately from routine checks,
      with severity and outcome.
- [ ] **Daily intake/output logging** — hay, water, pellets, urine and droppings for sick bunnies.
- [ ] **Procedure & surgery records** — desexing, dental work, abscess surgery, etc. with dates
      and notes.
- [ ] **Parasite treatments** — mites/fleas/worms log with retreat dates.
- [ ] **Vaccination certificates** — upload a photo/PDF per vaccination.
- [ ] **Weight-trend PDF / printable vet summary** — one-page profile, current meds, recent
      weights, vaccines and notes for the vet.

**Care & supplies**
- [ ] **Food & supply inventory** — hay, pellets, critical care, litter with reorder levels, like
      the drug cabinet.
- [ ] **Purchase history & spend** — per supplier, with cost totals per bunny.

**Scheduling & comms**
- [ ] **Custom reminders** — one-off and recurring chores per bunny, assigned to a worker.
- [ ] **Medication/appointment notifications** — PWA push or email for due meds, vaccines, care
      and appointments, with per-user preferences.
- [ ] **Foster rota/handover** — who has which bunny this week, with a handover note.
- [ ] **Calendar export per worker** — a feed of just their assigned bunnies' events.

**Data & reporting**
- [ ] **Global search** — find bunnies, notes, meds and vets from one box.
- [ ] **Audit log** — who created/edited/deleted what.
- [ ] **CSV import** — bulk intake bunnies from a spreadsheet.
- [ ] **Scheduled JSON backups** — nightly backup file with retention.
- [ ] **Barcode/QR hutch labels** — scan to open a bunny's page (needs a QR encoder or a small
      dependency decision).

**UX & mobile**
- [ ] **Bulk actions** — archive/assign/carer several bunnies at once.
- [ ] **Multi-bunny quick log** — log the same observation for several bunnies in one go.
- [ ] **Custom fields per rabbit** — e.g. insurance number, chip registry.
- [ ] **Photo location/EXIF capture.**
- [ ] **Offline queue for phone logging.**
- [ ] **Multi-household support.**
- [ ] **Barcode/microchip lookup integrations.**

## Testing conveniences (temporary)

- Light/dark theme toggle, persisted per browser.
