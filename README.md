# Finq Home Assignment — Shai Israeli

Full-stack app for action-item.co.il's home assignment: fetch random people from
[randomuser.me](https://randomuser.me), browse/filter them, save a subset to a backend, and edit a
saved or unsaved profile on a bidirectional (RTL/LTR) detail screen.

- **`client/`** — Vite + Vue 3 (Composition API) + TypeScript + Pinia + Vue Router, plain CSS.
- **`server/`** — Node + TypeScript + Express 5 + SQLite (`better-sqlite3`), no auth.

See `client/README.md` and `server/README.md` for per-side detail, `DECISIONS.md` for the
reasoning behind the notable choices, and `AI_USAGE.md` for how AI tooling was used to build this.

## Quick start

Requires Node.js 18+ (developed on v24.16.0) and npm. Two terminals, both must be running:

```bash
# Terminal 1 — backend, http://localhost:3001
cd server
npm install
npm run dev

# Terminal 2 — frontend, http://localhost:5173
cd client
npm install
npm run dev
```

Open `http://localhost:5173`. The backend must be running for anything that touches
`/api/profiles` (Save/Update-on-saved/Delete on Screen 3, and Screen 2's list) — Screen 1's
random-fetch and local-only name edits work without it.

## Screens

- **`/`** — Home: two buttons, Fetch → `/random`, History → `/saved`.
- **`/random`** — 10 random people from randomuser.me, filterable by name/country, click a row to
  open its detail screen. Header nav links to `/saved`.
- **`/saved`** — profiles persisted to the backend, same row UI and filter. Header nav links back
  to `/random`.
- **`/profile/:id`** — detail screen (RTL layout, Hebrew labels, LTR-isolated data fields):
  Save/Update/Delete depending on saved status, Back returns to wherever you came from.

## What to look at first

- `client/src/stores/profiles.ts` — the single shared Pinia collection every screen reads/writes,
  and the optimistic-update-with-rollback logic (the extension feature).
- `client/src/views/ProfileDetailView.vue` — the BiDi implementation and the save/update/delete
  state machine.
- `server/src/routes/profiles.ts` + `server/src/db/profilesRepository.ts` — the API/DB layer.
- `docs/planning/pm-breakdown.md` and `docs/planning/architecture.md` — the design docs the
  implementation was built against, including the exact acceptance criteria for the
  save/update/delete flows.

## Testing this was done

No automated test suite (out of scope for the time box — see `DECISIONS.md`). Verified instead
via: `npm run typecheck` / `tsc --noEmit` on both sides, manual `curl` testing of all four
endpoints and edge cases (`docs/planning/qa-report-backend.md`), and live browser walkthroughs of
every save/update/delete flow plus the BiDi input (`docs/planning/qa-report-frontend.md`).
