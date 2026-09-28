# Architecture — Finq Home Assignment

Design doc for implementation. Written against `CLAUDE.md` (contract) and
`docs/planning/pm-breakdown.md` (state-machine acceptance criteria, Sections 0/2/3/4). This
document makes the remaining implementation decisions; nothing below should require re-litigating
the PM's calls.

---

## 1. Client file structure

```
client/src/
  main.ts                       # app bootstrap: createApp, pinia, router, mount
  App.vue                       # <RouterView/> only — no layout logic
  style.css                     # global reset + base element styles (imports tokens.css)
  styles/
    tokens.css                  # CSS custom properties: design tokens (Section 8)

  types.ts                      # Profile, ProfileName, ProfileLocation (Section 3)

  router/
    index.ts                    # route table (Section 4)

  stores/
    profiles.ts                 # the one Pinia store (Section 2)
    navigation.ts                # tiny store: last click origin ('random'|'saved'|null) (Section 4)

  api/
    http.ts                     # fetch wrapper: base URL, JSON parsing, typed error throwing
    randomUserApi.ts            # fetchRandomUsers() + mapRandomUserToProfile()
    profilesApi.ts              # fetchProfiles/createProfile/updateProfileName/deleteProfile

  composables/
    useDebouncedFilter.ts        # local filter-text ref + 300ms debounce (Section 2 filter UX)

  views/
    HomeView.vue                 # Screen 0 — /
    RandomListView.vue           # Screen 1 — /random
    SavedListView.vue            # Screen 2 — /saved
    ProfileDetailView.vue        # Screen 3 — /profile/:id

  components/
    ProfileRow.vue               # shared row: thumbnail, name, gender, country, phone, email, badge
    ProfileFilterInput.vue        # single text input, wraps useDebouncedFilter
    ErrorBanner.vue              # inline error banner (Screen 1/2 list errors, Screen 3 action errors)
    SavedBadge.vue                # small "Saved" pill, used inside ProfileRow
```

Notes:
- `navigation.ts` is a *separate, tiny* Pinia store from `profiles.ts` — it holds one piece of
  ephemeral UI state (click origin), not profile data. Keeping it separate makes it obvious it is
  not part of the "one shared collection" the PM's Section 0 is protective of.
- No `services/` vs `stores/` split beyond this — 4h budget, one store for data, one for nav intent.

---

## 2. Pinia store design (`stores/profiles.ts`)

### State

```ts
interface ProfilesState {
  profilesById: Record<string, Profile>;   // the one shared collection, keyed by login.uuid
  randomBatchIds: string[];                // ids from the most recent /random fetch, in order

  randomStatus: 'idle' | 'loading' | 'success' | 'error';
  randomError: string | null;

  savedStatus: 'idle' | 'loading' | 'success' | 'error';
  savedError: string | null;

  actionError: string | null;              // Save/Update/Delete failure banner (Screen 3)
}
```

**Deliberate choice: no separate `savedIds` array.** "Screen 2's list" is a **getter**, not
stored state:

```ts
const savedProfiles = computed(() =>
  Object.values(profilesById.value).filter(p => p.savedInBackend)
);
const randomBatchProfiles = computed(() =>
  randomBatchIds.value.map(id => profilesById.value[id]).filter(Boolean)
);
const getProfileById = (id: string) => profilesById.value[id];
```

This is the load-bearing decision from PM Section 0: if Screen 2's list were its own array kept in
sync by hand, every mutation (Save/Update/Delete) would need to remember to also patch that array,
and that's exactly the class of bug PM Section 5 calls the highest risk. Deriving it as a computed
over `profilesById` makes divergence structurally impossible.

### Actions

All four network-touching actions follow the same optimistic pattern: **mutate `profilesById`
synchronously before the `await`, fire the request, and on rejection restore the captured
pre-mutation snapshot** (the extension, PM Section 4). `actionError` is set on failure and cleared
at the start of the next mutating action / on leaving Screen 3.

```ts
fetchRandomBatch(): Promise<void>
```
- `randomStatus = 'loading'`.
- `GET https://randomuser.me/api/?results=10` via `randomUserApi.fetchRandomUsers()`.
- Map each result to `Profile` via `mapRandomUserToProfile` with `savedInBackend: false`.
- **Upsert**, don't overwrite blindly: for each mapped profile `p`, if `profilesById[p.id]` already
  exists, keep its existing `savedInBackend` (and current `name`, in case it was locally edited or
  saved already) — only add it if absent. This is what makes "badges recomputed per new id" (PM
  Flow A.7) correct in the near-impossible case of an id collision across fetches.
- Set `randomBatchIds` to the new 10 ids (full replace, per PM Flow A.7).
- `randomStatus = 'success'`; on network failure `randomStatus = 'error'`, `randomError = message`
  (no mutation to roll back — this action has no optimistic phase, it's a pure read).

```ts
fetchSaved(): Promise<void>
```
- `savedStatus = 'loading'`.
- `GET /api/profiles` via `profilesApi.fetchProfiles()`.
- Map each row to `Profile` with `savedInBackend: true`, upsert into `profilesById` (backend is
  the source of truth for saved rows, so these **do** overwrite existing entries fully).
- `savedStatus = 'success'` / `'error'`.

```ts
saveProfile(id: string, name: ProfileName): Promise<void>
```
Implements PM Flow A. `name` is passed in explicitly by the caller as the *current form value*, so
an edited-but-not-yet-committed name is included even if the user never clicked Update (Flow A.3).
- Precondition: `profilesById[id]` exists and `savedInBackend === false`.
- Snapshot `{ name: previousName, savedInBackend: false }` for rollback.
- **Optimistic**: `profilesById[id].name = name; profilesById[id].savedInBackend = true`
  (synchronous, before network call — Screen 3 and Screen 1's badge update immediately).
- `POST /api/profiles` with the full current `profilesById[id]` payload.
- On 201: no further mutation needed (already applied); clear `actionError`.
- On failure: restore the snapshot (`savedInBackend = false`, `name = previousName`), set
  `actionError = "Couldn't save — please try again"`.

```ts
updateProfileName(id: string, name: ProfileName): Promise<void>
```
Implements PM Flows B and C.
- If `profilesById[id].savedInBackend === false` (Flow B): mutate `profilesById[id].name = name`
  synchronously. **No network call.** Done.
- If `savedInBackend === true` (Flow C): snapshot `previousName`, mutate `profilesById[id].name =
  name` optimistically, then `PATCH /api/profiles/:id` with `{ name }`. On failure: restore
  `previousName`, set `actionError`.

```ts
deleteProfile(id: string): Promise<void>
```
Implements PM Flow D.
- Precondition: `profilesById[id].savedInBackend === true`.
- Snapshot the full profile object for rollback.
- **Optimistic**: `profilesById[id].savedInBackend = false` (do **not** delete the dict entry —
  see rationale below).
- `DELETE /api/profiles/:id`.
- On 204: done (already applied).
- On failure: restore `profilesById[id] = snapshot` (flips `savedInBackend` back to `true`), set
  `actionError`.

**Why flip the flag instead of deleting the map entry:** PM's data-model note calls out that a
deleted saved profile might still be present in the *currently displayed* Screen 1 batch (id
collision case). Setting `savedInBackend = false` naturally makes it vanish from the `savedProfiles`
getter (Screen 2) while leaving it correctly un-badged if it's also in `randomBatchIds` (Screen 1).
Deleting the key outright would work for the common case but would throw away exactly the
information PM's edge case depends on, for zero benefit (the dict is small; keeping stale-but-flagged
entries is free).

### Where filter state lives

The 300ms-debounced filter text is **view-local state**, not store state — implemented once via
`composables/useDebouncedFilter.ts` and used identically in `RandomListView.vue` and
`SavedListView.vue` (matching the PM's "reuse the filter component as-is" instruction). It is UI
state, not shared data, so it doesn't belong in `profiles.ts`.

---

## 3. Shared TypeScript types

**Decision: no shared-types package.** There's no monorepo tooling (no workspaces, no build step
linking `client`/`server`). For a 4h assignment, duplicating one small interface in
`client/src/types.ts` and `server/src/types.ts` and keeping them manually in sync is the pragmatic
choice — the type is ~15 lines, changes maybe once, and the alternative (npm workspace, path
mapping, or a symlinked package) burns setup time for zero runtime benefit at this scale. This is
called out in `DECISIONS.md` as a deliberate corner cut with the production fix noted (a shared
`packages/types` workspace).

```ts
// client/src/types.ts  (and, minus savedInBackend, server/src/types.ts)

export interface ProfileName {
  title: string;
  first: string;
  last: string;
}

export interface ProfileLocation {
  streetNumber: number;
  streetName: string;
  city: string;
  state: string;
  country: string;
}

export interface ProfilePicture {
  thumbnail: string;
  large: string;
}

export interface Profile {
  id: string;                 // randomuser.me login.uuid — primary key everywhere
  name: ProfileName;
  gender: string;
  dob: string;                // ISO 8601 date, e.g. "1985-04-12"
  age: number;                // from randomuser.me dob.age, or computed server-side on insert
  location: ProfileLocation;
  email: string;
  phone: string;
  picture: ProfilePicture;
  savedInBackend: boolean;    // CLIENT-ONLY. Not a DB column — presence in the table means true.
}
```

Both a randomuser.me-mapped object (`savedInBackend: false`, via `mapRandomUserToProfile`) and a
backend row (`savedInBackend: true`, via the mapper in `profilesApi.ts`) are normalized into this
exact shape before entering `profilesById`, so every view/component only ever depends on `Profile`
and never on either source format directly.

Server's `server/src/types.ts` defines `StoredProfile = Omit<Profile, 'savedInBackend'>` — the
server never needs that flag; a row's existence in SQLite **is** "saved".

---

## 4. Router design (`router/index.ts`)

```ts
const routes = [
  { path: '/',              name: 'home',    component: HomeView },
  { path: '/random',        name: 'random',  component: RandomListView },
  { path: '/saved',         name: 'saved',   component: SavedListView },
  { path: '/profile/:id',   name: 'profile', component: ProfileDetailView, props: true },
];
```

Only 4 routes, exactly per CLAUDE.md. `/profile/:id` carries **only** the id — no `source` segment
or query param, per spec.

### Origin tracking

**Decision: a tiny dedicated Pinia store (`stores/navigation.ts`), not `history.state` and not a
query param.**

```ts
// stores/navigation.ts
interface NavigationState {
  lastOrigin: 'random' | 'saved' | null;
}
setOrigin(origin: 'random' | 'saved'): void   // called by ProfileRow's click handler
```

`RandomListView`/`SavedListView`'s row-click handler calls `navigationStore.setOrigin('random' |
'saved')` immediately before `router.push({ name: 'profile', params: { id } })`.
`ProfileDetailView`'s Back button reads `navigationStore.lastOrigin` and pushes `/random` or
`/saved` accordingly — never `router.back()` (a plain history pop is exactly the fragile approach
PM Section 5 warns against: it breaks under deep-link/refresh and can't be reasoned about
independent of browser history depth).

This was chosen over Vue Router's native `state` option (`router.push({ path, state })`, backed by
the History API) because that API is easy to get subtly wrong across router versions/typings and
buys nothing here — a small store is simpler, testable without a browser, and explicitly "not the
URL" per spec.

### Direct navigation / refresh on `/profile/:id` — explicit call

**This is a documented corner cut, handled gracefully rather than left broken:**

- On a hard refresh or direct link to `/profile/:id`, both Pinia stores reset, so
  `navigationStore.lastOrigin` is `null` and `profilesById` is empty.
- **Origin fallback:** if `lastOrigin` is `null`, Back targets `/random`. Building persistence
  (e.g. `sessionStorage`) for a case the spec never exercises (all navigation to Screen 3 in the
  happy path is a row click) is not worth 4h budget.
- **Data fallback:** on mount, `ProfileDetailView` checks `profilesById[id]`. If missing, it calls
  `fetchSaved()` once (covers "this is actually a saved profile, just not loaded into this fresh
  session yet") and re-checks. If still missing (e.g. it only ever existed as an ephemeral
  random-fetch result from a prior session), render a small "Profile not found" state with a link
  to `/`, rather than crashing on `profilesById[id].name` being undefined.
- This fallback is cheap (~5 min) and prevents an ugly crash, so it's included; full state
  persistence across refresh is the cut corner, documented in `DECISIONS.md`.

---

## 5. Backend structure

```
server/src/
  index.ts                     # express app wiring, cors, json body parsing, mount routes, listen
  db/
    connection.ts              # better-sqlite3 instance + schema creation (CREATE TABLE IF NOT EXISTS)
    profilesRepository.ts      # all SQL lives here: getAll, getById, insert, updateName, remove
  routes/
    profiles.ts                # express.Router — the 4 handlers, thin: validate → call repo → respond
  validation/
    profileValidation.ts       # validateCreateProfileBody(), validatePatchNameBody()
  types.ts                     # StoredProfile, ProfileRow (snake_case DB row shape)
```

Route handlers only: parse/validate input, call the repository, map errors to status codes. No
inline SQL in `routes/profiles.ts` — all SQL is in `profilesRepository.ts`.

### SQLite schema

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id              TEXT PRIMARY KEY,   -- login.uuid from randomuser.me
  title           TEXT NOT NULL,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  gender          TEXT NOT NULL,
  dob             TEXT NOT NULL,      -- ISO 8601 date string
  age             INTEGER NOT NULL,
  street_number   INTEGER NOT NULL,
  street_name     TEXT NOT NULL,
  city            TEXT NOT NULL,
  state           TEXT NOT NULL,
  country         TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT NOT NULL,
  picture_thumbnail TEXT NOT NULL,
  picture_large     TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Every field Screen 3 displays has a column (name parts, gender, dob + age, street
number/name/city/state/country, email, phone, both picture URLs). `id TEXT PRIMARY KEY` enforces
uniqueness at the DB level as a backstop under the app-level 409 check.

### Endpoint → DB operation mapping

| Endpoint | Repository call | SQL shape |
|---|---|---|
| `GET /api/profiles` | `getAll()` | `SELECT * FROM profiles ORDER BY created_at ASC` |
| `POST /api/profiles` | `getById(id)` then `insert(row)` | `SELECT ... WHERE id=?` guard, then `INSERT INTO profiles (...) VALUES (...)` |
| `PATCH /api/profiles/:id` | `getById(id)` then `updateName(id, name)` | `UPDATE profiles SET title=?, first_name=?, last_name=? WHERE id=?` |
| `DELETE /api/profiles/:id` | `getById(id)` then `remove(id)` | `DELETE FROM profiles WHERE id=?` |

`getById` is called first in POST/PATCH/DELETE purely for correct status-code decisions (409/404);
`better-sqlite3` calls are synchronous, so there's no race between the check and the write within a
single request.

---

## 6. API contract

Wire format mirrors the client `Profile` type (minus `savedInBackend`, which is implicit — a row
existing means saved).

### `GET /api/profiles`

`200 OK`
```json
[
  {
    "id": "3d2b6c1a-...-uuid",
    "name": { "title": "Mr", "first": "John", "last": "Doe" },
    "gender": "male",
    "dob": "1985-04-12",
    "age": 41,
    "location": { "streetNumber": 123, "streetName": "Main St", "city": "Springfield", "state": "IL", "country": "USA" },
    "email": "john.doe@example.com",
    "phone": "555-1234",
    "picture": { "thumbnail": "https://...", "large": "https://..." }
  }
]
```

### `POST /api/profiles`

Request body: full `Profile` shape (minus `savedInBackend`), same as one array element above.

- `201 Created` — body: the stored row (same shape).
- `400 Bad Request` — malformed body (missing/wrong-typed required field):
  ```json
  { "error": { "message": "Missing or invalid field: email" } }
  ```
- `409 Conflict` — `id` already exists:
  ```json
  { "error": { "message": "Profile with id 3d2b6c1a-...-uuid already exists" } }
  ```

**Decision: 409, not idempotent 200, on duplicate POST.** The client's own state machine only ever
shows the Save button when `savedInBackend === false`, so a duplicate POST for the same id should
not happen in normal use — if it does, it's a client bug (exactly PM Section 5's top risk: the
shared collection diverging). A hard 409 surfaces that loudly during development/testing; an
idempotent 200 would silently mask it. Documented in `DECISIONS.md`.

### `PATCH /api/profiles/:id`

Request body:
```json
{ "name": { "title": "Mr", "first": "Jonathan", "last": "Doe" } }
```

- `200 OK` — body: the full updated row (same shape as GET).
- `400 Bad Request` — body isn't `{ name: { title, first, last } }` with all three as strings.
- `404 Not Found`:
  ```json
  { "error": { "message": "No profile found with id 3d2b6c1a-...-uuid" } }
  ```

### `DELETE /api/profiles/:id`

- `204 No Content` — no body.
- `404 Not Found` — same error shape as above.

### Error shape (uniform across all endpoints)

```ts
interface ApiError {
  error: { message: string };
}
```

---

## 7. BiDi implementation (Screen 3 only)

`ProfileDetailView.vue` template root:

```html
<div class="profile-detail" dir="rtl">
  <h1>{{ profile.name.title }} {{ profile.name.first }} {{ profile.name.last }}</h1>

  <label>מגדר</label>
  <span>{{ profile.gender }}</span>

  <label>שם</label>
  <input
    class="ltr-field"
    dir="ltr"
    type="text"
    v-model="draftFirstName"
  />

  <label>אימייל</label>
  <span class="ltr-field" dir="ltr">{{ profile.email }}</span>

  <label>טלפון</label>
  <span class="ltr-field" dir="ltr">{{ profile.phone }}</span>

  <label>כתובת</label>
  <span>
    <span class="ltr-field" dir="ltr">{{ profile.location.streetNumber }}</span>
    {{ profile.location.streetName }}, {{ profile.location.city }}
  </span>

  <label>מדינה</label>
  <span>{{ profile.location.state }}</span>

  <label>גיל</label>
  <span>{{ profile.age }}</span>

  <label>שנת לידה</label>
  <span>{{ birthYear }}</span>
</div>
```

Scoped CSS:

```css
.profile-detail {
  direction: rtl;
  text-align: right;
}

/* Applied to every LTR-content field: name input, email, phone, street number */
.ltr-field {
  direction: ltr;
  text-align: left;
  unicode-bidi: isolate;   /* isolates the run so RTL context can't reorder digits/punctuation
                               at the field's boundary, independent of the dir attribute */
  display: inline-block;
}
```

**Rules, concretely, so no judgment call is left to the developer:**
1. `dir="rtl"` goes on the `.profile-detail` wrapper only — never on `<body>`/`<App>` (PM: no BiDi
   requirement outside Screen 3).
2. Every LTR-content node gets **both** the HTML `dir="ltr"` attribute **and** the `.ltr-field`
   class. The HTML attribute is what fixes caret/selection/typing behavior in the editable name
   `<input>` (CSS `direction: ltr` alone does not reliably fix caret placement — this is the
   specific risk PM Section 5 flags); the class adds `unicode-bidi: isolate` and `text-align: left`
   as belt-and-suspenders since RTL ancestry can still pull visual alignment.
3. The only editable field, the name `<input>`, must be manually verified by actually typing into
   it (not just eyeballed) per PM's explicit risk callout — put this in the manual test checklist
   before calling Screen 3 done.
4. Static Hebrew labels are hardcoded strings in the template (no i18n library — out of scope).

---

## 8. Styling approach

Plain CSS, no framework. Convention:

- **`styles/tokens.css`** — the entire design-token set, imported once at the top of
  `style.css`:
  ```css
  :root {
    --color-bg: #ffffff;
    --color-surface: #f7f7f8;
    --color-border: #e0e0e0;
    --color-text: #1a1a1a;
    --color-text-muted: #666666;
    --color-primary: #2563eb;
    --color-danger: #dc2626;
    --color-success: #16a34a;

    --space-1: 4px;
    --space-2: 8px;
    --space-3: 16px;
    --space-4: 24px;

    --radius: 6px;
    --font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  ```
- **`style.css`** — global reset (`box-sizing`, margin/padding zero on `body`/`h1`/etc.), base
  typography using `var(--font-family)`, and a handful of **shared utility classes** used by more
  than one component so they aren't reimplemented per-file:
  - `.button`, `.button--primary`, `.button--danger` (Save/Update/Delete/Back)
  - `.badge` (the "Saved" indicator)
  - `.error-banner` (Screen 1/2 fetch errors, Screen 3 action errors — one visual pattern)
  - `.loading` (simple text/spinner state)
- **Per-component `<style scoped>`** — layout/spacing specific to that component only, always
  referencing `var(--...)` tokens rather than hardcoded colors/spacing, so visual consistency holds
  without a component library.
- `ProfileRow.vue` owns the row layout (used identically by Screen 1 and Screen 2 — build once,
  per PM). No screen-specific row styling forks.

This is deliberately thin: one token file + one global utility sheet + scoped styles per component
is enough structure for ~8 components in a 4h build without hand-rolled inconsistency, and without
pulling in a CSS framework that would fight the BiDi requirement (CLAUDE.md's stated reason for
avoiding a component library).
