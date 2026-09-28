# QA Report — Backend / Code Review

Scope: code review of `server/src/` and `client/src/` against `CLAUDE.md`, `docs/planning/pm-breakdown.md`,
and `docs/planning/architecture.md`, plus backend curl testing. No browser automation performed (out of
scope for this pass — covered by a parallel live-UI QA agent).

**Operational note on this session's backend testing:** when I went to start the backend, a server for
this project was *already running* (`tsx watch src/index.ts`, PID 34217/34218, bound to `:3001`, up since
before this session started) — evidently the one the parallel live-UI QA agent is driving. This was
confirmed empirically: the saved profile's name changed between two of my `GET /api/profiles` calls
without me touching it (`"DaliborEdited"` → `"DaliborFlowC"`), consistent with that agent actively running
PM Flow C (Update) through the browser during my testing window. All curl tests below transparently hit
that live, shared server. My own `npm run dev` invocation raced against it and its child process lost
(no child ended up bound to the port) — I killed that redundant supervisor process (PID 35118) since it
held nothing. **I deliberately did not kill the live server (34217/34218) and did not delete
`server/data/app.db*`**, since both are in active use by the concurrent live QA session and destroying
them would corrupt that agent's test state. I did clean up every row I personally inserted during testing
(`qa-c`, `qa-race-1`) so the DB's content is back to exactly what it was before my session (just the one
pre-existing saved profile). `git status` shows only `?? server/data/`, which was already present/untracked
before I touched anything (see Minor finding on `.gitignore` below for why that entry can never fully go
away as currently configured).

---

## Blocker

None found.

---

## Major

### M1 — No in-flight guard on Save/Update/Delete; a fast Save→Update sequence can PATCH a profile before its POST has landed

**What's wrong:** `stores/profiles.ts`'s `saveProfile`, `updateProfileName`, and `deleteProfile` all flip
`savedInBackend` optimistically *before* awaiting the network call, but nothing tracks "an action is
in flight" or disables the corresponding buttons. Concretely: the **Update** button on Screen 3
(`ProfileDetailView.vue` line 166, `<button class="button" type="button" @click="handleUpdate">Update</button>`)
has no `v-if`/`:disabled` gating at all — it's visible and clickable at all times, including the instant
after Save's optimistic flip.

Sequence: user clicks **Save** on an unsaved profile → `saveProfile` synchronously sets
`savedInBackend = true` and fires `POST /api/profiles` (await, not yet resolved) → the Save button
disappears (was `v-if="!profile.savedInBackend"`) and the Update button (always visible) is still there →
user edits the name and clicks **Update** before the POST resolves → since `profilesById[id].savedInBackend`
is already (optimistically) `true`, `updateProfileName` takes the "saved" branch (PM Flow C) and fires
`PATCH /api/profiles/:id` for a row that may not exist in SQLite yet.

Because Express processes requests synchronously and in-order per connection, this usually resolves in
the client's favor, but it is not guaranteed by any code-level contract — and even in the best case it's
two overlapping network calls racing to write the same field, with the *last response to resolve* winning
(not the last request *sent*), which the architecture doc doesn't address. If the PATCH does land before
the POST's insert, it 404s, and `updateProfileName`'s catch path rolls back to `previousName` and sets
`actionError`, which can then be immediately clobbered by the POST's success handler
(`profilesById.value[id] = saved`) restoring the Save-time name — so the user's Update is silently lost
with no error surfaced (the `actionError` from the failed PATCH gets overwritten, and the successful POST
doesn't re-check it). This is a genuine, plausible-under-normal-use ordering bug, not just a rapid-double-click
edge case.

The same root cause (no precondition/in-flight check) means a genuine double-click on **Save** or
**Delete** produces two overlapping requests for the same id. The second one always fails at the backend
(409 for a second Save, 404 for a second Delete — confirmed safe at the DB/API layer, see Verified list),
so no data corruption results, but the *client* shows a **spurious `"Couldn't save/delete — please try
again"` error banner even though the action actually succeeded**, because the second call's rollback runs
after the fact and stomps `actionError`.

**Evidence (code):**
- `client/src/stores/profiles.ts` — `saveProfile` (lines 92–110), `updateProfileName` (lines 113–135),
  `deleteProfile` (lines 138–155): none check a "pending" flag or the documented precondition
  (`saveProfile`'s architecture.md-documented precondition "profilesById[id] exists and
  savedInBackend === false" is never actually enforced in code — only `if (!current) return;` guards it).
- `client/src/views/ProfileDetailView.vue` lines 149–168: Save/Delete/Update/Back buttons have no
  `:disabled` state tied to an in-flight action; Update (line 166) has no visibility gating whatsoever.

**Violates:** PM Section 2's implicit assumption that Save/Update/Delete are mutually exclusive per
saved-state ("Update button — always visible... Branches on savedInBackend" in architecture.md §2 assumes
the branch is evaluated once per click against a stable state, not mid-flight-of-another-action);
practically, it breaks "a failed Save/Update/Delete leaves state unchanged" (PM §2 cross-cutting rule) —
here a *successful* Update can be silently lost while the UI reports failure for the wrong action.

**Fix direction (not applied, per instructions):** track `pendingAction: 'save'|'update'|'delete'|null`
per profile id (or globally, since only one Screen 3 is mounted at a time) and disable all three
mutating buttons while a request for that id is in flight.

---

## Minor

### N1 — `updateProfileName`'s local-only branch (Flow B) never clears `actionError`

`architecture.md` §2 states `actionError` is "cleared at the start of the next mutating action." The
saved branch of `updateProfileName` (PATCH path) and `saveProfile` both do `actionError.value = null`
before their optimistic mutation, but the unsaved/local-only branch does not:

```ts
// client/src/stores/profiles.ts lines 117–121
if (!current.savedInBackend) {
  // Flow B: no network call, mutate the shared collection only.
  profilesById.value[id] = { ...current, name };
  return;
}
```

Repro: on Screen 3 for an unsaved profile, trigger any prior action failure (e.g. stop the backend,
click Save → error banner shows), then restart the backend, edit the name and click **Update** (Flow B,
local-only, no network call). The stale error banner from the earlier failed Save remains on screen even
though this Update succeeded and nothing failed.

**File:** `client/src/stores/profiles.ts` lines 113–121.

### N2 — No client-side validation on the editable name field; empty name silently accepted locally, then surfaces as a confusing generic error on Save

The name `<input>` on Screen 3 (`ProfileDetailView.vue` line 118–124, `v-model="draftFirstName"`) has no
`required`/non-empty check. If the user clears it and clicks **Update** on an *unsaved* profile (Flow B,
local-only), the store happily writes an empty `first` into the shared collection with no validation —
`client/src/stores/profiles.ts` line 119 (`profilesById.value[id] = { ...current, name };`) does no
checking at all. The empty name then renders in Screen 1/2's row and Screen 3's header. If the user later
clicks **Save**, the backend's `isString()` check (`server/src/validation/profileValidation.ts` line
11–13, requires `value.length > 0`) correctly rejects it with 400, which triggers `saveProfile`'s
rollback + generic `"Couldn't save — please try again"` banner — technically correct behavior, but the
message gives no indication the actual cause is an empty required field, and the failure is deferred
until Save instead of being caught immediately at the input.

**File:** `client/src/views/ProfileDetailView.vue` (name input, lines 118–124);
`client/src/stores/profiles.ts` (`updateProfileName` local branch, line 119).

### N3 — Malformed JSON request body returns Express's default HTML error page, not the app's documented `{ error: { message } }` shape

`architecture.md` §6 promises a uniform error shape "across all endpoints." There is no JSON-parsing error
handler / no global error-handling middleware in `server/src/index.ts`. A syntactically invalid JSON body
is caught by `express.json()` (body-parser), which does set `err.status = 400` (so the *status code* is
correct — see evidence below), but Express's default `finalhandler` then renders it as an HTML stack
trace, not the app's JSON error contract:

```
$ curl -s -w "\nSTATUS:%{http_code}\n" -X POST http://localhost:3001/api/profiles \
    -H "Content-Type: application/json" -d '{not valid json'

<!DOCTYPE html>...<pre>SyntaxError: Expected property name or '}' in JSON at position 1...
at parse (/…/server/node_modules/body-parser/lib/types/json.js:91:21)
...
STATUS:400
```

This also leaks the server's absolute filesystem path in the stack trace (a minor info-disclosure smell
for a dev server, not a real security issue here since it's local-only/no-auth by design, but worth
flagging as a habit). Not reachable through the normal UI (the client only ever sends `JSON.stringify`'d
valid objects), but any direct API consumer or automated contract test hitting this endpoint would see it.

**File:** `server/src/index.ts` — no `app.use((err, req, res, next) => ...)` error-handling middleware is
registered anywhere.

### N4 — No global error-handling middleware / no try-catch around repository calls; the DB-level uniqueness backstop, if ever hit, would 500 with a raw stack trace instead of a clean 409

The app-level 409 check (`getById` before `insert`) works correctly today — verified below with 5
concurrent duplicate POSTs producing exactly 1×201 + 4×409 and no 500s or duplicate rows, thanks to
Node's single-threaded event loop plus `better-sqlite3`'s synchronous calls (no actual race window exists
in the current code path). However, `profilesRepository.insert()` (`server/src/db/profilesRepository.ts`
lines 47–79) has no `try/catch`, and there is still no global error-handling middleware (see N3). If a
future code change ever let a duplicate `id` reach `insert()` (bypassing the app-level check), the
`SqliteError: UNIQUE constraint failed` would propagate as an unhandled synchronous throw and produce the
same raw-HTML/500 response as N3, not the documented 409. This is purely a defensive-coding gap today
(not currently triggerable), but is exactly the kind of "backstop that isn't really a backstop" architecture.md
§5's `id TEXT PRIMARY KEY` justification implies should be handled gracefully.

**File:** `server/src/db/profilesRepository.ts` (`insert`, lines 47–79); `server/src/index.ts` (no error
middleware).

### N5 — `mapRandomUserToProfile` has no defensive handling for missing/unexpected fields from randomuser.me

`client/src/api/randomUserApi.ts` lines 28–54 access every field by direct property chain
(`result.dob.date`, `result.location.street.number`, `result.picture.large`, etc.) with no optional
chaining or fallback. I fetched the live API (`curl 'https://randomuser.me/api/?results=1'`) and confirmed
today's real response shape matches the mapper's assumptions exactly (`login.uuid`, `dob.date`/`dob.age`,
`location.street.number`/`.name`, `picture.large`/`.thumbnail` are all present as expected) — so this is
not currently broken. But if the third-party API ever changes shape or omits a field for one result, the
resulting `TypeError` (e.g. "Cannot read properties of undefined") is thrown synchronously inside
`fetchRandomUsers()`'s `.map()` call, which is *not* wrapped in its own try/catch — only the initial
`fetch()` call is. It does still get caught one level up, by `fetchRandomBatch`'s try/catch in
`stores/profiles.ts` (lines 57–72), so the app won't hard-crash to a white screen — but the user would see
the raw JS error text ("Cannot read properties of undefined (reading 'date')") in the error banner instead
of the friendly `"Failed to fetch random users"` fallback, since `err.message` is used verbatim when
`err instanceof Error`.

**File:** `client/src/api/randomUserApi.ts` lines 28–54.

### N6 — `.gitignore` doesn't cover WAL/SHM sidecar files, so any local dev run leaves `server/data/` untracked

`.gitignore` has `*.db`, `*.sqlite`, `*.sqlite3`, which covers `app.db` but not the `-wal`/`-shm` sidecar
files SQLite's WAL journal mode (`server/src/db/connection.ts` line 17,
`db.pragma("journal_mode = WAL")`) creates alongside it (`app.db-shm`, `app.db-wal`). Since those two
files don't match any pattern, `server/data/` always shows as an untracked directory in `git status` after
running the server locally, even though the intent (per `*.db` being ignored) is clearly for the whole
data directory to be excluded.

**File:** `/Users/shaiisraeli/Documents/finq-home-assignment/.gitignore`.

---

## Nitpick

### P1 — PATCH checks id-existence before body validation, so a malformed body against a non-existent id returns 404 instead of 400

`server/src/routes/profiles.ts` lines 46–64: the handler calls `profilesRepository.getById(id)` and
returns 404 first, *then* validates the body. Tested directly:

```
$ curl -s -w "\nSTATUS:%{http_code}\n" -X PATCH .../profiles/does-not-exist \
    -H "Content-Type: application/json" -d '{"name":"not an object"}'
{"error":{"message":"No profile found with id does-not-exist"}}
STATUS:404
```

Against a real, existing id, a malformed body correctly 400s (see Verified list) — so this only matters
for the combination of "both id and body are wrong," where the id-not-found message wins. Neither the PM
breakdown nor architecture.md specifies check ordering, so this isn't a contract violation, just a
possibly-surprising choice worth a second look (a caller debugging a bad PATCH body against a typo'd id
would be told the wrong thing is wrong).

### P2 — `isString()` rejects empty strings for every string field, including `title`/`last`

`server/src/validation/profileValidation.ts` line 11–13: `isString` requires `value.length > 0`. This
means any string field — not just `name.first` — is rejected as "missing" if it's an empty string rather
than absent, e.g. `location.city: ""` fails with `"Missing or invalid field: location.city"`. Stricter
than "field present, correct type" as architecture.md frames the validation goal, but a defensible product
choice, not a bug (ties into N2's UX gap on the client for `name.first` specifically).

---

## Verified working, no issues found

- **8 baseline contract checks**, all exactly as `architecture.md` §6 documents:
  - `POST` valid → `201` + stored row.
  - `POST` duplicate id → `409` with `{"error":{"message":"Profile with id <id> already exists"}}`.
  - `GET /api/profiles` → `200` + JSON array.
  - `PATCH` valid (existing id) → `200` + full updated row.
  - `PATCH` missing id → `404` with `{"error":{"message":"No profile found with id <id>"}}`.
  - `POST` missing top-level field (e.g. `email`) → `400` with a precise field name in the message.
  - `DELETE` existing → `204` no body.
  - `DELETE` again (already gone) → `404`.
- **Nested sub-field validation is solid**, contrary to expectation it might crash: `POST` with
  `location: { streetNumber: 5 }` (missing streetName/city/state/country) → clean `400`,
  `"Missing or invalid field: location.streetName"`. `POST` with `name: { title: "Mr" }` (missing
  first/last) → clean `400`, `"Missing or invalid field: name"`. No 500s, no crashes.
- **Type-mismatch validation is solid**: `age: "41"` (string instead of number) → clean `400`,
  `"Missing or invalid field: age"`. `location.streetNumber: "5"` (string) → clean `400`. `isFiniteNumber`
  correctly rejects non-numeric types instead of coercing.
- **`PATCH` malformed `name` against a real, existing id** — tested three shapes (missing sub-field,
  `name` as a plain string, empty body `{}`) — all three return a clean `400` with the message
  `"Missing or invalid field: name (expected { title, first, last })"`. No crash.
- **Empty body `{}`** on `POST` → clean `400` (`"Missing or invalid field: id"`, the first field checked).
  On `PATCH` (against an existing id) → clean `400` for the name field.
- **Concurrency/race test**: fired 5 simultaneous `POST` requests for a brand-new id in parallel — result
  was exactly 1×`201` and 4×`409`, zero `500`s, and `GET` afterward confirmed exactly one row exists.
  Confirms `id TEXT PRIMARY KEY` + Node's single-threaded event loop + `better-sqlite3`'s synchronous
  calls fully eliminate the theoretical POST-vs-POST race — no window for duplicate rows exists in the
  current code path.
- **SQL injection**: sent a `DELETE` with a path-injected id
  (`qa'; DROP TABLE profiles;--`, URL-encoded) — treated as a harmless literal string, returned a clean
  `404`, and the `profiles` table was confirmed intact afterward via `GET`. Every query in
  `profilesRepository.ts` uses `better-sqlite3` prepared statements with `?`/`@named` parameters — no
  string concatenation into SQL anywhere.
- **`client/src/api/http.ts`** correctly special-cases `res.status === 204` and returns `undefined` without
  calling `.json()` on an empty body (lines 42–44) — the `DELETE` 204 no-body response is handled cleanly,
  no crash. Its `parseErrorMessage` also gracefully falls back to a generic message if the error response
  itself isn't JSON (e.g. the HTML page from N3/N4) — wrapped in try/catch, no crash propagates to the UI.
- **`randomUserApi.ts` field mapping matches the real API** — fetched
  `https://randomuser.me/api/?results=1` live and diffed field paths against the mapper: `login.uuid`,
  `dob.date`/`dob.age`, `location.street.number`/`.name`, `location.city/state/country`,
  `picture.large`/`.thumbnail` all present and correctly consumed today (see N5 for the no-defensive-coding
  caveat if this ever changes upstream).
- **`RandomListView.vue`'s `onMounted` guard** (`if (profilesStore.randomBatchIds.length === 0)`,
  line 36) is present and correct — confirms the previously-fixed re-fetch-on-every-mount bug stays fixed.
- **`goBack()` in `ProfileDetailView.vue`** (lines 54–57) is purely origin-based
  (`navigationStore.lastOrigin === 'saved' ? '/saved' : '/random'`), never derived from current
  `savedInBackend` status — correctly implements PM §2's "Back respects origin, not status" rule.
- **Name-field editability**: verified `currentDraftName()` (`ProfileDetailView.vue` lines 45–52) always
  carries `title`/`last` through unchanged from the store and only substitutes `draftFirstName` for
  `first`, in both `handleSave` and `handleUpdate` — matches "only the name's first name is editable"
  everywhere Save/Update fires. No path bypasses this.
- **Upsert-not-overwrite in `fetchRandomBatch`** (`stores/profiles.ts` lines 59–66): correctly skips
  overwriting an existing `profilesById[id]` entry on id collision, preserving its `savedInBackend`/name,
  and only inserts genuinely-new ids — matches architecture.md §2 exactly.
- **`useDebouncedFilter.ts`**: `onUnmounted` clears the pending `setTimeout` (lines 21–23) — no leaked
  timer/stale-closure bug across route changes.
- **All `v-for` loops** (`RandomListView.vue` line 63, `SavedListView.vue` line 53) have a correct,
  stable `:key="profile.id"` — no missing/index-based keys found anywhere in the codebase.
- **CORS**: `server/src/index.ts` restricts `origin` to `http://localhost:5173` (the Vite dev origin), per
  spec — not wide open.

---

## Verdict

**Backend contract and validation logic are in solid shape — every explicit backend edge case in this
assignment's scope (8 baseline checks + all new nested/type/empty-body edge cases + a concurrency race
test + a SQL-injection probe) returned exactly the documented status/shape with zero crashes or unhandled
500s.** The one Major finding (M1) is a real client-side state-machine gap — no in-flight guard on
Save/Update/Delete — that can produce a lost Update or a spurious error banner under realistic fast-user
interaction, and is worth fixing before this is called done; everything else is Minor/Nitpick polish
(error-shape consistency on malformed-JSON edge cases, a `.gitignore` gap, missing client-side empty-name
validation). Not release-blocking, but M1 should not ship silently.
