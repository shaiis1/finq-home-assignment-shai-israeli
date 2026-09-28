# Decisions

## 1. One shared collection, two derived views — not two separately-synced lists

Screen 1 (random batch) and Screen 2 (saved) both read from a single Pinia state,
`profilesById: Record<id, Profile>`, keyed by randomuser.me's `login.uuid`. Each screen's list is
a **computed getter** over that collection (`randomBatchProfiles`, `savedProfiles`), not its own
stored array. The alternative — two separate arrays kept in sync by hand on every Save/Update/
Delete — is the classic source of "I saved it but the other screen didn't update" bugs, and this
assignment's grading explicitly weighs judgment on exactly this state machine. Deriving instead of
syncing makes that class of bug structurally impossible rather than something to test for.
**Tradeoff:** every mutation now needs the full collection in memory, which is irrelevant at this
scale (tens of rows) but wouldn't hold as a pattern for a large paginated dataset.

## 2. SQLite (`better-sqlite3`), not in-memory or Postgres

File-backed SQLite persists across server restarts (unlike a plain in-memory array) with zero
external setup (unlike Postgres — no Docker, no connection string). Its synchronous API keeps the
repository layer (`profilesRepository.ts`) plain functions instead of async wrappers.
**Tradeoff:** single-writer, single-process only — not appropriate for multiple app-server
instances. Fine here; the repository layer is isolated enough that swapping engines later wouldn't
touch routes or validation.

## 3. `POST` returns `409` on a duplicate id, not an idempotent `200`

The client only ever shows the Save button when a profile is unsaved, so a duplicate POST should
never happen in normal use. If one does, it means the shared-collection state diverged — exactly
the highest-risk bug in this app. A hard 409 surfaces that loudly during development; a silent
idempotent 200 would mask it. Confirmed safe under concurrency: 5 simultaneous POSTs for the same
new id produced exactly one 201 and four 409s, no duplicate rows.

## BiDi approach

Screen 3's wrapper gets `dir="rtl"` with hardcoded Hebrew labels. Each LTR-content field (editable
first name, email, phone, street number) gets **both** the HTML `dir="ltr"` attribute — required
for correct caret/typing behavior inside an RTL ancestor, not just visual direction — **and** a
`.ltr-field` CSS class (`direction: ltr; text-align: left; unicode-bidi: isolate`) as a visual
backstop. Verified by actually typing into the name field, not just eyeballing static rendering.

## Corners cut (deliberately, given the time box)

- **No shared types package** — `Profile` is duplicated in `client/src/types.ts` and
  `server/src/types.ts`. A monorepo workspace would remove the duplication but costs setup time
  for a ~15-line interface that changes rarely. Production fix: `packages/types`.
- **Navigation origin doesn't survive a hard refresh/deep link to `/profile/:id`** — origin is
  tracked in a small Pinia store, not the URL or `sessionStorage`, so a refresh resets it and Back
  falls to `/random`. The profile itself still loads correctly (refetched from the backend if
  saved); only "which list you came from" is lost. Not worth building for a path the spec's happy
  flow never exercises.
- **No automated test suite** — verified via `tsc`/`vue-tsc` typechecking, manual `curl` coverage
  of every endpoint and edge case, and live browser walkthroughs of all four save/update/delete
  flows instead (see `docs/planning/qa-report-*.md`).
- **No defensive coding against randomuser.me changing its response shape**, and two backend
  polish items (PATCH validates id-existence before body shape; empty strings are rejected the
  same as missing fields) — all confirmed non-issues against the live API today, documented as
  known gaps rather than fixed, to keep QA cleanup inside its time box.

## Extension: optimistic updates with rollback (≤100 words)

Save/Update/Delete on Screen 3 mutate the shared collection **synchronously**, before the network
call resolves — the UI updates with zero perceived latency. On failure, the mutation is rolled
back to a captured snapshot and an inline error banner appears. Chosen over a generic polish item
(loading skeletons, a11y pass) because it's the one extension that stress-tests this app's actual
hardest problem — the save-state machine — rather than decorating it. Verified by killing the
backend mid-action and confirming the UI reverts. Cut corner: single attempt, no retry/backoff.
