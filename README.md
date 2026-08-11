<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/a6ac0f09-5a16-44bc-b587-2ececc81cb0e

## Run Locally

**Prerequisites:**  Node.js and a running MySQL server (e.g. XAMPP or MySQL 8).

1. Install dependencies:
   `npm install`
2. Create `.env` from `.env.example` and set your `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
3. Run the app (starts the API on `:3001` and Vite dev server on `:3000`):
   `npm run dev`

The app is available at **http://localhost:3000**. The Vite dev server proxies
`/api/*` to the Express backend, which persists all state to **MySQL**
(configured via `DB_*` variables in `.env` — the schema and demo data are
created automatically on first run).

### Authentication

Sessions use signed JWTs (`JWT_SECRET` in `.env`, HS256 via `node:crypto`).

- All demo accounts use the password **`password123`** (e.g. `branch.user`,
  `it.staff`, `admin`).
- The login screen lists the demo accounts for quick sign-in.
- The API enforces auth: every `/api/*` route except `login` /
  `demo-accounts` / `health` requires `Authorization: Bearer <token>`.
- Actors are derived from the token — the server ignores any `currentUser`
  sent in request bodies. Admin-only actions return `403` for other roles.
- Password hashes never leave the server (scrypt hashed).

### Notes

- The API writes to MySQL incrementally (only changed rows) instead of
  rewriting every table on each request, and `/api/state` returns a
  role-filtered snapshot (branch users only receive their branch's tickets).
- The UI deep-links every screen (`/tickets`, `/tickets/:id`, `/admin/users`,
  …) and polls the API every 30s (plus on window focus) so open tabs stay in
  sync.
- A full auth flow is now implemented for the prototype; role-based UI
  switching is still available via the topbar "Persona" menu (demo only).

> You do not need a `GEMINI_API_KEY` for this app.

### Production mode

`npm run build && npm start` — serves the compiled frontend and API from `:3001`.

### Other scripts

- `npm run lint` — TypeScript type check (`tsc --noEmit`)
- `npm test` — vitest unit tests for the shared store logic
- `npm run dev:web` — Vite only (expects the API already on `:3001`)
- `npm run dev:server` — API only
