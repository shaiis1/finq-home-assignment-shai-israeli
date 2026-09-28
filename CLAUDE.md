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
- **Screen 3 (`/profile/:source/:id`)**: large image, gender, editable name, age+birth year,
  address (street number+name, city, state), email, phone.
  - **Save** — visible only if source=random (not yet in DB) → `POST /api/profiles`.
  - **Delete** — visible only if source=saved (already in DB) → `DELETE /api/profiles/:id`.
  - **Update** — name is editable; if saved → `PATCH /api/profiles/:id`; if not saved → update the
    in-memory Screen 1 list via the Pinia store (this is why state must live in a store, not props).
  - **Back** — navigate back.
  - **BiDi**: screen wrapper is `dir="rtl"` with Hebrew static labels; LTR-content fields (name,
    email, phone, street number) get `dir="ltr"` individually so they stay left-to-right and editable
    correctly inside the RTL layout.

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
