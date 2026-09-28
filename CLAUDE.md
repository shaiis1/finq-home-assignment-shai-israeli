# Project: Full Stack Home Assignment (Vue 3 + Node/TS)

Home assignment for action-item.co.il. Source spec:
`~/Downloads/Full_Stack_Action_Item_Test_v3_2_Vue-new.pdf`. Time-boxed to ~4h; judgment/decisions
matter more than feature count. AI use is explicitly permitted but every line must be defensible.

## Stack

- `client/`: Vite + Vue 3 + TypeScript, Composition API (`<script setup>`), Vue Router, Pinia,
  plain CSS (no component library — chosen for full control over the BiDi requirement below).
- `server/`: Node + TypeScript + Express, SQLite via `better-sqlite3`. No auth.

## Screens (client)

- **Screen 0 (`/`) Home**: two buttons — Fetch → `/random`, History → `/saved`.
- **Screen 1 (`/random`)**: fetch 10 people from `https://randomuser.me/api/?results=10`. Row shows
  thumbnail, name (title+first+last), gender, country, phone, email. Filter by name + country.
  Click row → Screen 3.
- **Screen 2 (`/saved`)**: same row UI, data from backend (`GET /api/profiles`).
- **Screen 3 (`/profile/:id`)**: large image, gender, editable name, age+birth year,
  address (street number+name, city, state), email, phone. Routed by `id` alone — saved/unsaved
  status is derived live from the shared Pinia collection (keyed by `login.uuid`), not baked into
  the URL, since status can change mid-visit (e.g. right after Save). Navigation origin (`/random`
  vs `/saved`) is tracked via route state, not a URL segment, so **Back** always returns to where
  the user actually came from regardless of current saved status.
  - **Save** — visible only when unsaved → `POST /api/profiles`. On success, row stays in Screen 1's
    list (doesn't disappear) and gets a "Saved" badge.
  - **Delete** — visible only when saved → `DELETE /api/profiles/:id`.
  - **Update** — name is editable; if saved → `PATCH /api/profiles/:id`; if not saved → update the
    shared Pinia collection only (this is why state must live in a store, not props/route params).
  - **Back** — navigate to actual origin screen (Screen 1 or 2), never chosen by current save status.
  - **BiDi**: screen wrapper is `dir="rtl"` with Hebrew static labels; LTR-content fields (name,
    email, phone, street number) get `dir="ltr"` individually so they stay left-to-right and editable
    correctly inside the RTL layout.

See `docs/planning/pm-breakdown.md` for the full save/update/delete state-machine acceptance
criteria (flows A–D), filter UX rationale, and extension pick.

## Backend API contract

- `GET /api/profiles` — list saved profiles
- `POST /api/profiles` — persist a profile (id = randomuser.me `login.uuid`)
- `PATCH /api/profiles/:id` — update a saved profile's name
- `DELETE /api/profiles/:id` — remove a saved profile

## Required deliverables (do not forget)

- `client/README.md`, `server/README.md`, root `README.md` (overview + how to run both sides)
- `DECISIONS.md` (root, max 1 page): 3 interesting decisions + tradeoffs, BiDi approach, corners cut
  deliberately + what to do in production, and the chosen extension (≤100 words)
- `AI_USAGE.md` (root): honest disclosure of AI tool usage
- One deliberate extension (~30 min scope), documented in DECISIONS.md
