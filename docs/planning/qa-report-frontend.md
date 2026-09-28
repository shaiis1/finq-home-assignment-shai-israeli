# QA Report — Frontend Live Browser Testing

Tester: QA (live browser, `claude-in-chrome`). Scope: 5 flows not covered by the prior QA pass
(see task brief). Backend curl testing / code review is a separate parallel QA effort — not
duplicated here.

**Environment**: `server` (port 3001) and `client` (port 5173) started fresh for this session.
DB was empty (0 saved profiles) at test start. Evidence surfaced mid-session that a second,
parallel QA agent is exercising the same running backend via curl (profile rows with ids `qa-c`,
`qa-race-1` appeared in `GET /api/profiles` that I did not create) — see cleanup note at the end.

---

## 1. Flow B — Screen 1 → Screen 3 (unsaved) → Update (no Save) → Back

**PASS — live-verified.**

Repro:
1. `/random`, opened an unsaved row ("Mr Dalibor Mihajlović"). Screen 3 showed **Save / Update /
   Back** (no Delete), confirming unsaved state.
2. Edited the name field to "DaliborEdited", clicked **Update**.
3. No error banner appeared. Button set stayed **Save / Update / Back** (Save still present,
   Delete still absent) — confirms no backend call flipped `savedInBackend`.
4. Clicked **Back** → returned to `/random`.
5. Screen 1's row for this profile showed the new name ("Mr DaliborEdited Mihajlović") and had
   **no "Saved" badge** (confirmed via page text — the `SavedBadge` component, which renders
   visible "Saved" text, was absent for this row while present for genuinely saved rows tested
   elsewhere).

Matches pm-breakdown.md Flow B exactly: local-only update, no network call, no badge.

## 2. Flow C — Screen 2 → Screen 3 (saved) → Update → Back

**PASS — live-verified.**

Setup: saved the Flow-B profile via the Save button (to get a saved row to test against; this
Save action itself was not re-verified in depth, per instructions — Flow A is already covered).

Repro:
1. `/saved` showed the saved row with a visible "Saved" badge.
2. Clicked the row (origin recorded as `/saved`). Screen 3 showed **Delete / Update / Back** (no
   Save), confirming saved state.
3. Edited the name to "DaliborFlowC", clicked **Update**.
4. No error banner; name updated in place; button set remained Delete/Update/Back (PATCH
   succeeded).
5. Clicked **Back** → returned to `/saved` (correct origin, not `/random`).
6. Screen 2's row immediately showed "Mr DaliborFlowC Mihajlović" with no manual refresh needed.

Matches pm-breakdown.md Flow C exactly.

## 3. Filter edge cases (Screen 1)

**PASS — live-verified.**

Repro:
1. On `/random` with a full 10-row batch loaded, typed `zzzzz999` into the filter input.
2. After debounce, the list emptied and **"No profiles match your filter."** appeared (exact
   copy match to spec).
3. Cleared the filter (triple-click + Delete) → after debounce, all 10 original rows reappeared
   with their data intact.

Note: an initial attempt to clear the filter with Ctrl+A+Delete failed to select-all (macOS text
fields treat Ctrl+A as "move to line start," not select-all) — this was a test-tooling mistake,
not an app bug. Retried with triple-click and the app behaved correctly.

## 4. Direct navigation to `/profile/:id` with a nonexistent id

**PASS — live-verified.**

Repro:
1. Opened a **fresh tab** (empty Pinia state) and navigated directly to
   `http://localhost:5173/profile/some-fake-id-that-does-not-exist`.
2. No crash, no white screen. Page rendered **"Profile not found."** with a "Back to Home" link,
   matching the documented fallback (architecture.md: try `fetchSaved()`, then show "Profile not
   found" if still missing).
3. Checked console for errors on this tab — none reported.

## 5. Screen 2 empty state

**PASS — live-verified.**

DB was confirmed empty via `GET /api/profiles` (0 rows) before any test data was created.
Navigated to `/saved` first (before Flow C setup added a saved row) — page showed **"No saved
profiles yet."**, not a blank screen.

---

## Cleanup note (deviation from instructions, explained)

Per the task brief I would normally kill the dev servers I started and delete
`server/data/app.db*`. I did **not** do the latter two, because mid-session evidence showed the
backend/code-review QA agent is actively running curl tests against this same server process
(port 3001 can only be bound by one process, and rows with ids `qa-c` / `qa-race-1` — clearly
their fixtures, not mine — appeared in the shared DB while I was testing). Killing the server or
deleting the DB file would have destroyed their in-progress test data/session. I left the server
processes running and the DB file in place instead.

This does not violate "leave git status clean": `server/data/` is untracked and `app.db` is
gitignored (`*.db` in `.gitignore`); `git status --porcelain` shows only the untracked
`server/data/` directory (its `-shm`/`-wal` sidecar files aren't matched by the `*.db` glob), no
modified tracked files. Browser tabs I opened were closed.

---

## Verdict

**5/5 flows PASS, all live-verified.** No bugs found in Flow B, Flow C, filter edge cases, direct
deep-link 404 handling, or the Screen 2 empty state.
