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
- [x] **Printable bunny report.** Period presets (day, week, month, all time, custom) and a
      light-themed PDF export of the full record — profile, weights, checks, daily checks,
      medication, treatments, vaccinations, routine care, appointments and journal, with optional
      photos.
- [x] **Shareable live reports.** A public, token-gated link per bunny (`#/share/<token>/<id>`)
      renders the read-only report screen without the app shell, auto-refreshes every minute, hides
      costs, and can be revoked by regenerating the token in Settings. Photos load with the same
      token, and the authenticated report and share page render from one shared bundle.
- [x] **Grouped profile + richer daily checks.** The bunny profile is a flat, ordered stack of
      cards (Observations, Daily routine, Health checks, Treatments & medication, Notes & photos,
      Appointments, Bunny details), daily check types can be multi-select, logs can carry photos,
      and a one-tap type bar logs poo or behaviour without opening the full form.
- [x] **Bowl scale tracking.** Per-bunny food/water bowls with a starting weight, rolling weigh-ins
      that calculate consumption since the last reading, top-ups recorded as the amount added or the
      bowl's new total, a refresh action that starts a new period with an optional final weight, and
      optional times of day that show on the calendar with tick-off and one-tap weigh/top-up.
- [x] **Daily routine tasks.** Repeating chores per bunny with morning/afternoon/evening/anytime
      slots and an every-N-days repeat, and one-tap completion from the bunny profile or the home
      Today list.
- [x] **Sunday check with daily observations.** The full health check form can switch on any
      configured daily check type (poo, water, food, behaviour, …) as an optional section for that
      check; amounts and text are stored on the check and shown in the history table.
- [x] **Starter drug defaults.** An Add defaults button in the drug cabinet pulls in any missing
      starter medicines without touching edited or custom ones, so upgraded installs get new
      starters like Doxy 100 paste and Trimethoprim Sulfa (Deprim).
- [x] **Treatment schedule + calendar dosing.** Treatments carry the times of day each dose is
      given (early morning, morning, afternoon, evening, night); the calendar shows per-slot ticks
      and logs a dose on tap; linked doses group under the treatment on the bunny page with edit
      and delete (stock reconciled), one-off doses stay in the medication log, and logging a
      different amount can update the treatment's dose from that day on. The log form lists the
      day's doses and lets you override the time for that day, optionally adding it to the schedule
      going forward, and every edit pop-out warns before discarding unsaved changes.

- [x] **Time windows + food supplies.** Each time of day has a window (early morning 5–8, morning
      8–12, afternoon 12–5, evening 5–9, night 9–5); logging preselects the slot for the current
      time and flags early/late doses. Bowls gained an optional empty weight (so contents show), a
      linked food product, editable readings and a daily consumption chart, and a new Food &
      supplies catalog tracks stock with top-ups drawing from it.

- [x] **Growth norms, stages and missed doses.** Editable adult weight ranges per breed scaled by
      age, plus expected daily food/water per kg, shown as In range / Watch / Alert on the weight
      and Food & water cards; age-based growth stages with tick-off; direct consumption entry for
      bowls; and doses can be marked missed, with courses auto-completing once the end date has
      passed and the last dose is accounted for. Light theme is now the default.

- [x] **Bowl session logging.** One reading pop-up on the bunny profile replaces the separate
      weigh/consumption/top-up/refresh buttons: pick the action, add each reading to the session and
      save them together. The batch endpoint applies a session's readings chronologically in one
      transaction, so an invalid reading rolls the whole session back.

- [x] **Report charts, treatment schedules and share navigation.** The bunny report gained the
      range-aware bowl-consumption chart alongside the weight chart and a per-treatment schedule
      badge (completed / up to date / due / missed). Share links now reuse the report period
      controls (day, week, month, all time, custom) and add a read-only Calendar tab, and the daily
      check pop-up is a check-type list with the selected type's options on the right.

- [x] **Checklists + shared check items.** Daily check types and checklist questions now live side
      by side: named checklists group either kind of item, so a daily check can be added to the
      weekly checklist and show up on the health check form. The built-in Daily checks list drives
      the quick log, a dedicated Checklists page creates more lists for other programs, and the
      daily-check editor edits its options as rows like the checklist editor.

- [x] **Routine task templates + stock links.** Reusable routine tasks live in Settings → Daily
      routine and are added to a bunny in a tap (the task copies the template's fields). A task can
      link a food/supply product with an amount, and completing it draws the amount from stock;
      deleting the completion puts it back. Tasks take an optional start date, completions can be
      dated, and the calendar shows each task's schedule with ticks for the days it was completed.

- [x] **Calendar polish.** A filter bar narrows the month to one bunny or hides item types
      (appointments, medication, bowls, tasks, events, check logs, external), task chips are tappable
      to complete or undo a day, scheduled bowls only appear from their start date, today is
      highlighted in both themes, water bowls are drawn in blue, and routine-task due dates follow
      the Settings timezone instead of UTC.

- [x] **PIN-first sign-in.** The login screen always opens on the PIN pad — including after the idle
      lock — with an Email/Password button to reach the username-and-password form and a Use PIN
      button to switch back.

- [x] **Calendar tasks + multiple stock links.** Daily tasks use the same repeat choices as events
      (daily/weekly/monthly/custom), can be created and edited from the calendar, and a
      never-started task with no start date appears from today. Tasks, routine templates and bowls
      can each link several food/supply products, and completing a task (or topping up a bowl) draws
      from each linked product's stock.

- [x] **Feed now + last-logged reminders.** Food bowls gained a **Feed now** action in the reading
      pop-up: it records a top-up and a matching consumption in one batch, so food eaten straight
      away (greens, treats) counts as consumed and still draws from stock while the bowl weight
      stays put — weigh the bowl afterwards if anything is left over. Every logging pop-up (daily
      checks, bowl readings, task completions, medication doses and weight) now shows when that
      item was last logged.

- [x] **Task completion history.** Tapping an already-done task on the calendar now opens its
      completion history instead of prompting to undo. Each completion's date, time and notes can be
      edited and saved (via `PATCH /api/tasks/completions/:id`) or deleted, and the calendar
      refreshes behind the pop-up.

- [x] **Pop-up and calendar polish.** Every pop-up now warns before discarding unsaved changes
      (including the task complete and task history pop-ups, which had none), the bowl editor picks
      its linked food products from dropdown rows instead of toggle buttons, completed calendar
      chips stay green whether they were logged on time or late, and the calendar fetches bowl
      readings for the whole visible grid so an entry on a leading/trailing day ticks too.

- [x] **Completion ticks everywhere.** Completed calendar chips are now green across the board:
  routine tasks (✓, or `!` when the completion time is outside the task's slot window), completed
  appointments, and daily-check logs. Tapping a done task opens just that day's completion for
  editing rather than the whole history. On the bunny profile, **Mark done** on a routine-care item
  now asks for the date and optional notes, shows a green ✓ badge when not yet due, and the Health
  checks card ticks when a check was logged today.

- [x] **Time of day follows the time you enter.** Logging a bowl reading or a medication dose
  re-selects the matching time of day (Morning/Afternoon/Evening/Night) when the time changes,
  revealing every time of day when it is not part of the schedule. The task create/edit pop-up
  defaults its time of day to the current one, and the task completion pop-up shows which time of
  day the entered time falls into.

- [x] **Flexible schedules (recurrence).** Treatments, bowls and routine tasks each carry a
  structured repeat — every day, chosen weekdays, **N times a week on any days**, or every N days —
  instead of showing every day of the course. The calendar only draws a dose/reading/chore on the
  days it is due, a weekly quota stops showing once it is met for that week, and the same options
  are available on routine templates. Existing interval tasks migrate to the new model.

- [x] **One Routine card.** Routine care and daily routine are merged: care schedules/records became
  care-typed tasks and completions (the old `care_schedules`/`care_records` tables migrate into
  `rabbit_tasks`/`task_completions`), so a single card and a single edit pop-up cover chores and
  care rounds. The card still lists every care type with its schedule and next-due status.
- [x] **Checklists get a schedule, Quick log retires.** Quick log is gone; its checklist data now
  surfaces in the Daily checks card, where each checklist shows a due badge and a Log button. Every
  checklist carries a recurrence (the weekly checklist defaults to Sundays) and the recurrence
  editor lives in Settings → Checklists.
- [x] **Mobile + Log quick actions.** The home FAB opens a quick-action sheet: pick a bunny (skipped
  when there is only one active bunny) and jump straight to that area on its profile.

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
- [ ] **Auto-generated dose tasks** — create routine tasks for each active treatment automatically,
      so meds are never missed (manually linked tasks are done).
- [ ] **Symptom episodes** — track an episode (e.g. gut stasis) separately from routine checks,
      with severity and outcome.
- [ ] **Daily intake/output logging** — hay, pellets, urine and droppings for sick bunnies (bowl
      weighing for food and water is done).
- [ ] **Procedure & surgery records** — desexing, dental work, abscess surgery, etc. with dates
      and notes.
- [ ] **Parasite treatments** — mites/fleas/worms log with retreat dates.
- [ ] **Vaccination certificates** — upload a photo/PDF per vaccination.

**Care & supplies**
- [ ] **Food & supply inventory** — hay, pellets, critical care, litter with reorder levels, like
      the drug cabinet.
- [ ] **Purchase history & spend** — per supplier, with cost totals per bunny.

**Scheduling & comms**
- [ ] **Task assignment & reminders** — assign routine tasks to a worker and send due notifications
      (recurring chores themselves are done).
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
