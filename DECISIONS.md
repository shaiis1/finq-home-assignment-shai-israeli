# Decisions

## 1. One shared collection, two derived views

`profilesById: Record<id, Profile>` is the single source of truth; Screen 1's and Screen 2's lists
are `computed` getters over it, not separately-synced arrays. The alternative — two arrays kept in
sync by hand on every Save/Update/Delete — is the classic source of "I saved it but the other
screen didn't update" bugs. Deriving instead of syncing makes that bug class structurally
impossible rather than something to test for. **Tradeoff:** needs the full collection in memory;
irrelevant at this scale, wouldn't hold as a pattern for a large paginated dataset.

## 2. SQLite (`better-sqlite3`), not in-memory or Postgres

File-backed SQLite persists across restarts (unlike an in-memory array) with zero external setup
(unlike Postgres — no Docker, no connection string). Its synchronous API keeps the repository layer
plain functions instead of async wrappers. **Tradeoff:** single-writer, single-process only — fine
here; the repository is isolated enough to swap engines later without touching routes.

## 3. `POST` returns `409` on a duplicate id, not an idempotent `200`

The client only ever shows Save when a profile is unsaved, so a duplicate POST means the client's
state diverged from the server — exactly this app's highest-risk bug class. A hard 409 surfaces
that loudly; a silent 200 would mask it. Verified safe under concurrency: 5 simultaneous POSTs for
one new id produced exactly one 201 and four 409s, no duplicate rows.

## BiDi approach

Screen 3's wrapper gets `dir="rtl"` with hardcoded Hebrew labels. Each LTR-content field (editable
name input, email, phone, street number) gets **both** the HTML `dir="ltr"` attribute — required
for correct caret/typing behavior inside an RTL ancestor, not just visual direction — **and** a
`.ltr-field` CSS class (`direction: ltr; text-align: left; unicode-bidi: isolate`) as a visual
backstop. Verified by actually typing into the name field, not just eyeballing static rendering.

## Corners cut (deliberately, given the time box)

- **Only the first name is editable**, not title/last. The spec's "editable Name field" doesn't
  specify scope; a single field covers the Update flow's intent without a 3-field mini-form.
  Production fix: make title/last editable too if a real user need shows up for it.
- **No shared types package** — `Profile` is duplicated in `client/src/types.ts` and
  `server/src/types.ts` (~15 lines, changes rarely). Production fix: a `packages/types` workspace.
- **Navigation origin doesn't survive a hard refresh/deep link** to `/profile/:id` — it lives in a
  Pinia store, not the URL or `sessionStorage`. The profile itself still loads correctly (refetched
  from the backend if saved); only "which list you came from" resets to `/random`. Not worth
  building for a path the spec's happy flow never exercises.
- **No automated test suite** — verified via `tsc`/`vue-tsc` typechecking, manual `curl` coverage of
  every endpoint and edge case (including a 5-way concurrent-POST race and a SQL-injection probe),
  and live browser walkthroughs of all four save/update/delete flows instead.

## Extension: optimistic updates with rollback (≤100 words)

Save/Update/Delete on Screen 3 mutate the shared collection **synchronously**, before the network
call resolves — the UI updates with zero perceived latency. On failure, the mutation rolls back to
a captured snapshot and an inline error banner appears. Chosen over a generic polish item (loading
skeletons, an a11y pass) because it stress-tests this app's actual hardest problem — the
save-state machine — rather than decorating it. Verified by killing the backend mid-action and
confirming the UI reverts. Cut corner: single attempt, no retry/backoff — that's the next 30
minutes, not these.
