# client

Frontend for the Finq home assignment — Vite + Vue 3 (Composition API, `<script setup>`) +
TypeScript, Pinia, Vue Router. Plain CSS, no component library.

## Prerequisites

- Node.js 18+ and npm.

## Install

```bash
npm install
```

## Environment variables

None required — the app works out of the box against the local backend on `http://localhost:3001`.
To point it somewhere else, copy the example file and edit it:

```bash
cp .env.example .env.local
```

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:3001/api` | Backend base URL. |

`.env.local` is gitignored — it's for your own local overrides, not committed.

## Run (dev)

```bash
npm run dev
```

Opens at `http://localhost:5173`.

**Note:** the backend (`../server`) must also be running on `http://localhost:3001` for the
"Saved" features (Screen 2/3 Save, Update-on-saved, Delete) to work — Screen 1's random-fetch
list (`https://randomuser.me`) and local-only name edits (Flow B) work without it, but any action
that hits `/api/profiles` will fail (and, thanks to the optimistic-update extension, visibly
revert with an error banner) if the backend isn't up.

## Build

```bash
npm run build
```

Runs `vue-tsc -b` (typecheck) then `vite build`, output in `dist/`.

## Preview a production build

```bash
npm run preview
```
