# Server

Backend API for the Full Stack Home Assignment. Node + TypeScript (ESM) + Express 5, with
SQLite (`better-sqlite3`) for persistence. No auth.

## Prerequisites

- Node.js 18+ (developed/tested on Node v24.16.0; any current LTS should work fine since nothing
  here relies on Node internals beyond `fetch`/ESM support).
- npm.

## Install

```bash
cd server
npm install
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Port the Express server listens on. |

## Run (development)

```bash
npm run dev
```

Starts the server with `tsx watch` (auto-restarts on file changes) on
`http://localhost:3001` by default (override with `PORT`). A SQLite file is created at
`server/data/app.db` on first run (directory created automatically if missing).

## Build / run (production)

```bash
npm run build
npm start
```

`npm run build` compiles TypeScript to `dist/` via `tsc`; `npm start` runs the compiled
`dist/index.js`.

## Typecheck

```bash
npm run typecheck
```

## CORS

The Vite dev origin (`http://localhost:5173`) is allowed via `cors()` middleware in
`src/index.ts`.

## Endpoints

All request/response bodies are JSON. Errors share one shape:

```json
{ "error": { "message": "description of what went wrong" } }
```

### `GET /api/health`

Basic liveness check.

- `200 OK` — `{ "status": "ok" }`

### `GET /api/profiles`

List all saved profiles. Optional `?limit=N` query param caps the number of rows returned (ordered
oldest-first); omitted or invalid values return everything.

- `200 OK`
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

Persist a profile. `id` should be the randomuser.me `login.uuid`.

Request body: the full profile shape (same as one array element above, minus nothing — it's the
whole object).

- `201 Created` — the stored row (same shape as above).
- `400 Bad Request` — missing/wrong-typed required field, e.g.:
  ```json
  { "error": { "message": "Missing or invalid field: email" } }
  ```
- `409 Conflict` — `id` already exists:
  ```json
  { "error": { "message": "Profile with id 3d2b6c1a-...-uuid already exists" } }
  ```

Example:

```bash
curl -X POST http://localhost:3001/api/profiles \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-uuid-123",
    "name": { "title": "Mr", "first": "John", "last": "Doe" },
    "gender": "male",
    "dob": "1985-04-12",
    "age": 41,
    "location": { "streetNumber": 123, "streetName": "Main St", "city": "Springfield", "state": "IL", "country": "USA" },
    "email": "john.doe@example.com",
    "phone": "555-1234",
    "picture": { "thumbnail": "https://example.com/thumb.jpg", "large": "https://example.com/large.jpg" }
  }'
```

### `PATCH /api/profiles/:id`

Update a saved profile's name.

Request body:

```json
{ "name": { "title": "Mr", "first": "Jonathan", "last": "Doe" } }
```

- `200 OK` — the full updated row (same shape as `GET`).
- `400 Bad Request` — body isn't `{ name: { title, first, last } }` with all three as strings.
- `404 Not Found`:
  ```json
  { "error": { "message": "No profile found with id 3d2b6c1a-...-uuid" } }
  ```

### `DELETE /api/profiles/:id`

Remove a saved profile.

- `204 No Content` — no body.
- `404 Not Found` — same error shape as above.

## Project structure

```
server/src/
  index.ts                     # express app wiring, cors, json body parsing, mount routes, listen
  db/
    connection.ts              # better-sqlite3 instance + schema creation
    profilesRepository.ts      # all SQL: getAll, getById, insert, updateName, remove
  routes/
    profiles.ts                # express.Router — the 4 handlers
  validation/
    profileValidation.ts       # manual validation for POST/PATCH bodies
  types.ts                     # StoredProfile, ProfileRow (snake_case DB row shape)
```

See `docs/planning/architecture.md` (Sections 5-6) in the repo root for the full design rationale.
