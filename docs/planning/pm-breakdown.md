# PM Breakdown — Finq Home Assignment

Scope: planning only. No code. Written against `CLAUDE.md` (root) as source of truth for
routes/contracts. Decisions below are final calls for the developer to implement, not options to
re-litigate mid-build — the 4h box doesn't afford a second round of design debate.

---

## 0. Data model note (read this before Screen 1/2/3 breakdown)

To make the save/update/delete state machine (Section 2) implementable without ambiguity, there
must be **one client-side source of truth** for "have I seen this person and is it saved,"
keyed by `login.uuid`. Concretely (not prescribing the store's internals, just the shape needed):

- A single collection of profiles-by-id, each with a `savedInBackend: boolean` (or equivalent)
  flag, sourced from whichever is true first: it came back from `GET /api/profiles`, or a
  `POST /api/profiles` for it just succeeded.
- Screen 1's list = the 10 ids from the most recent random fetch, rendered from this collection.
- Screen 2's list = the ids where `savedInBackend === true`, rendered from this collection.
- Screen 3 reads/writes a single profile by id from this collection — it does not hold its own
  private copy that can drift from Screen 1/2.

This is why Section 2's answers ("stays in list, gets a badge," "Back respects origin not status")
are implementable in ~4h: one collection, two filtered views, no sync code between screens.

---

## 1. Task Breakdown

### Backend

- [ ] `GET /api/profiles` — return all rows from SQLite as JSON array, shape matching what the
      client needs to render Screen 2 rows + Screen 3 detail (i.e. store the full randomuser.me
      fields you need, not just name).
- [ ] `POST /api/profiles` — accept a full profile payload, use `id` = client-supplied
      `login.uuid` as primary key; return 201 + the stored row; return 409 (or idempotent 200) if
      `id` already exists — decide and document which, don't leave it to throw an unhandled 500.
- [ ] `PATCH /api/profiles/:id` — accept `{ name: { title, first, last } }` only; 404 if id not
      found; return the updated row.
- [ ] `DELETE /api/profiles/:id` — 204 on success; 404 if id not found.
- [ ] SQLite schema/migration: single `profiles` table, columns for every field Screen 3 displays
      (name parts, gender, dob date + age, location: street number/name/city/state/country,
      email, phone, large + thumbnail picture URLs), `id TEXT PRIMARY KEY`.
- [ ] Input validation: reject malformed POST/PATCH bodies with 400, not a 500 from a thrown
      exception — keep it minimal (required fields present, correct types), not a full schema lib.
- [ ] CORS enabled for the Vite dev origin.
- [ ] `server/README.md`: how to run, endpoint list with example request/response bodies.

### Screen 0 (Home)

- [ ] Two buttons, "Fetch" → `/random`, "History" → `/saved`. No data fetching on this screen.
- [ ] No loading/error states needed here — it's static.

### Screen 1 (Random List, `/random`)

- [ ] On mount, call `https://randomuser.me/api/?results=10`, map response into the shared
      collection (Section 0), tagged as this fetch's batch.
- [ ] Row component (shared with Screen 2 — build it once): thumbnail, `title first last`,
      gender, country, phone, email.
- [ ] Filter input per Section 3 recommendation below.
- [ ] Visual "Saved" indicator on rows where `savedInBackend === true` (see Section 2).
- [ ] Click row → navigate to Screen 3 for that id, recording that navigation originated from
      `/random` (for Back behavior — see Section 2).
- [ ] Loading state while the randomuser.me call is in flight; basic error state (e.g. API
      unreachable) with a retry action — this is the one network call most likely to flake in a
      live demo, don't skip its error path.
- [ ] A way to re-fetch (re-trigger the 10-person pull) without a full page reload — reuse the
      "Fetch" affordance or add a small refresh control.

### Screen 2 (Saved Profiles, `/saved`)

- [ ] On mount, call `GET /api/profiles`, populate the shared collection's saved rows.
- [ ] Reuse Screen 1's row component and filter component as-is (same UI, per spec).
- [ ] Click row → navigate to Screen 3 for that id, recording origin as `/saved`.
- [ ] Loading + empty state ("no saved profiles yet") + basic error state.

### Screen 3 (Profile Detail, `/profile/:id`)

- [ ] Route by `id` only (not by a static `source` param baked in at click time) — Screen 3
      derives current saved/unsaved status live from the shared collection, per Section 2's Back
      rule and the "flip on Save" requirement.
- [ ] Layout: large image, gender, editable name field, age + year of birth (computed from dob),
      address (street number + name, city, state), email, phone. Only the name field is editable
      (per spec) — everything else is read-only display.
- [ ] Save button — visible only when `savedInBackend === false`. On click: `POST /api/profiles`
      with the profile's *current in-form values* (including any unsaved name edit — see Section
      2 for why). On success, flips `savedInBackend` to true in the shared collection.
- [ ] Delete button — visible only when `savedInBackend === true`. On click: `DELETE
      /api/profiles/:id`. On success, removes the id from the shared collection's saved set and
      navigates Back (see Section 2).
- [ ] Update button — always visible (name is always editable). Branches on `savedInBackend`:
      true → `PATCH /api/profiles/:id` with the new name; false → writes the new name into the
      shared collection only, no network call.
- [ ] Back button — returns to the screen the user actually navigated from (`/random` or
      `/saved`), not to a screen chosen by current saved status. Use route state/history, not a
      hardcoded target.
- [ ] Basic inline error handling for failed Save/Update/Delete (e.g. banner at top of screen) —
      do not let a failed request silently no-op.

### BiDi Handling (Screen 3 only)

- [ ] Screen 3's root element: `dir="rtl"`, static labels in Hebrew ("מגדר", "שם", "כתובת",
      "אימייל", "טלפון", "גיל", "שנת לידה", "עיר", "מדינה"/"מחוז").
- [ ] Each LTR-content field (editable name input, email, phone, street number) gets its own
      `dir="ltr"` (and ideally `style="text-align: left"` since RTL ancestry can still pull text
      alignment) so the Latin text reads and edits left-to-right inside the RTL page.
- [ ] Verify the editable name `<input>` specifically: typing, caret movement, and text selection
      all behave correctly with `dir="ltr"` nested inside an RTL ancestor — this is the one part
      of BiDi handling that's easy to get visually right but functionally wrong (see Risks).
- [ ] No BiDi requirement on Screens 0/1/2 — don't over-apply RTL outside Screen 3.

### Extension (~30 min, after core spec works)

- [ ] See Section 4 for the specific pick and what to build.

---

## 2. Acceptance Criteria — the Saved-State Machine

This is the part most likely to be judged closely. Be exact.

### Terminology
- **Unsaved profile**: exists only in the client's random-fetch collection; `savedInBackend =
  false`.
- **Saved profile**: exists in the SQLite `profiles` table; `savedInBackend = true`.

### Flow A: Screen 1 → Screen 3 → Save → Back
1. User clicks a row on Screen 1. Screen 3 opens for that id, `savedInBackend = false`.
   Buttons shown: **Save**, **Update**, **Back**. (No Delete.)
2. User optionally edits the name field.
3. User clicks **Save**. Client POSTs the profile using the *current form values* (so an edited
   name is saved as edited, even if the user never clicked Update first — Save does not require a
   prior Update).
4. On success: `savedInBackend` flips to `true` for this id in the shared collection. Screen 3
   re-renders immediately with **Delete** + **Update** + **Back** (Save disappears) — the user
   does not need to leave and re-enter the screen to see this.
5. User clicks **Back**. They return to **Screen 1** (their actual origin), not Screen 2.
6. **On Screen 1, the row for this profile:**
   - **Does NOT disappear** from the list. It is still one of the 10 people from this fetch
     batch, and removing it would make the list feel lossy/confusing.
   - **Is visually marked** as saved (e.g. a "Saved" badge/checkmark next to the row).
   - Remains clickable; clicking it again opens Screen 3 with `savedInBackend = true`, i.e. now
     showing Delete/Update, not Save.
7. If the user triggers a brand-new Fetch (new 10 people) after this, the list is fully replaced;
   badges are recomputed per new id (in practice near-never pre-marked, since randomuser.me ids
   are fresh per call, but the check must still run for correctness).

### Flow B: Screen 1 → Screen 3 → Update (no Save) → Back
1. Same entry as Flow A, `savedInBackend = false`.
2. User edits the name field, clicks **Update** (not Save).
3. No network call. The shared collection's copy of this profile is updated with the new name.
4. `savedInBackend` remains `false` — Save is still visible; nothing was persisted.
5. Back → Screen 1 → the row now shows the **new name**, and is still un-badged (not saved).

### Flow C: Screen 2 → Screen 3 → Update → Back
1. User clicks a row on Screen 2. Screen 3 opens, `savedInBackend = true`. Buttons: **Delete**,
   **Update**, **Back**. (No Save.)
2. User edits name, clicks **Update**. Client PATCHes `/api/profiles/:id` with the new name.
3. On success, the shared collection's saved copy is updated in place.
4. Back → **Screen 2** (actual origin). The row reflects the new name without a manual refetch
   (patch the local collection on success; don't force a full `GET /api/profiles` reload, though a
   background refetch as a correctness safety net is fine).

### Flow D: Screen 2 → Screen 3 → Delete → Back
1. Entry as Flow C.
2. User clicks **Delete**. Client DELETEs `/api/profiles/:id`.
3. On success: id removed from the shared collection's saved set (`savedInBackend` reverts to
   `false` for that id if it also happens to still be present in a currently-displayed Screen 1
   batch — see data model note, this is why one shared collection matters).
4. Navigation: **Back after a successful Delete goes to Screen 2** (the origin), where the row is
   now simply absent from the (now-shorter) list. Do not attempt to show a "deleted" placeholder.

### Cross-cutting rules
- **Back respects navigation origin, not current saved status.** A profile that started as
  unsaved (opened from Screen 1) and got Saved mid-visit still goes Back to Screen 1, not Screen
  2, even though it's now technically a saved profile. This is a deliberate, simple rule — don't
  build "smart" back-routing based on status, it adds complexity the spec doesn't ask for and
  creates surprising navigation.
- **Only the name field is ever editable**, regardless of saved status. PATCH's payload is
  therefore always just the name.
- **A failed Save/Update/Delete leaves state unchanged** (unless doing the optimistic-update
  extension — see Section 4, which changes this to "changed then rolled back").

---

## 3. Filter UX Recommendation — Decisive

**One single text input**, not two separate name/country fields. Matches case-insensitively
against **either** the person's full name (`title first last`) **or** their country, substring
match, on every keystroke, **debounced 300ms**.

**Rationale**: 10 rows is a trivial dataset — there's no performance case for two fields or for
instant (non-debounced) filtering; one input covers "filter by name and country" with the least
UI and the least code, and 300ms is the standard sweet spot for perceived-instant-but-not-janky
text filtering. Do not build two inputs, a dropdown-for-country, or client-side fuzzy matching —
none of that is asked for and all of it burns time versus the golden path.

---

## 4. Extension Recommendation — Decisive

**Pick: Optimistic updates with rollback**, applied specifically to the three mutating actions on
Screen 3 — Save, Update (when PATCHing), and Delete.

**Rationale**: the spec itself weights judgment/decisions as the top evaluation criterion, and
this is the single extension that most directly demonstrates judgment *on the hardest part of
this exact spec* — the saved-state machine in Section 2 — rather than a generic polish item
(a loading skeleton or an a11y pass would be safer but demonstrate nothing about this app's actual
hard problem). It's also genuinely ~30 minutes because the state machine in Section 2 already has
to exist; optimism + rollback is a thin wrapper around it, not new architecture.

**What to build, concretely:**
- In the store action that performs Save/Update/Delete: mutate the shared collection
  **immediately** (flip `savedInBackend`, apply the name edit, or remove the row) *before* the
  network call resolves, so Screen 3's buttons and Screen 1/2's list update with zero perceived
  latency.
- Fire the actual `POST`/`PATCH`/`DELETE` in the background.
- On failure (non-2xx or network error): **revert** the mutation (flip the flag back, restore the
  previous name, re-insert the deleted row) and show an inline error banner on Screen 3
  ("Couldn't save — please try again").
- Prove it works by testing the failure path explicitly (e.g. stop the server, click Save, confirm
  the UI reverts and shows the error) — an optimistic-update extension that's only ever tested on
  the happy path is indistinguishable from not having rollback at all, and a reviewer may well
  check this.
- Document this explicitly in `DECISIONS.md` under the extension write-up, including the one
  deliberate corner cut: no retry/backoff, a single attempt then rollback (that would be the next
  30 minutes, not these 30).

---

## 5. Risks / Things to Watch

- [ ] **The saved-state machine (Section 2) is the highest-risk piece of the whole assignment.**
      Get the shared-collection data model right *before* writing Screen 1/2/3 components — if
      Screen 3 holds a private copy of the profile instead of reading/writing the shared
      collection, Flows A/B/C/D above will silently diverge (e.g. Screen 1's badge not updating
      after Save from Screen 3).
- [ ] **BiDi caret/selection behavior**, not just visual direction. `dir="rtl"` on the wrapper
      with `dir="ltr"` on individual fields is easy to get looking right and still be broken for
      actual typing/caret placement in the editable name input — test by actually typing into it,
      not just eyeballing static rendering.
- [ ] **`login.uuid` as primary key**: make sure the client maps and carries this id consistently
      from the moment of fetch — if it's re-derived or dropped anywhere in the pipeline (e.g. a
      component that reshapes the object and forgets the id), Save/Update/Delete will silently
      target the wrong record or fail 404.
- [ ] **Back navigation** is origin-based per Section 2, not status-based — a naive
      `router.back()` might accidentally work most of the time but breaks if the user deep-links
      or refreshes on Screen 3; use explicit route/query state for origin, not just browser
      history.
- [ ] **randomuser.me flakiness** in a live demo/interview setting — make sure Screen 1's error
      state is real and tested (e.g. via devtools network throttling/blocking), not just a
      theoretical `catch` block.
- [ ] **Optimistic-rollback extension, if built, must be demonstrably tested against failure**,
      not just the happy path (see Section 4) — an unverified rollback is a bug waiting to be
      found by whoever reviews this.
- [ ] **Time-box discipline**: the golden path (Flows A–D, filter, BiDi on Screen 3) is worth more
      than any edge case. Resist polishing Screen 0/1/2 visuals or adding extra validation beyond
      what's listed here until the golden path and the extension are both solid end to end.
