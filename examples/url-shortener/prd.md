# URL Shortener — PRD

**Date:** 2026-04-12
**Status:** approved
**Purpose:** Test spec for brigade plugin `/brigade:plan @prd.md` flow. Full-stack feature
across designer, frontend, and nodejs roles.

## Goal

Build a minimal URL shortener: users paste a long URL, get a short code, share the short
URL, and see click stats. One page, one API, one database. Ship-ready in ~1 sprint.

## Approach

- **Backend:** Node.js + Fastify + SQLite (via better-sqlite3). No ORM, raw SQL. Single
  process, single file database (`data/urls.db`).
- **Frontend:** React + Vite + Tailwind. Single page, no routing library. State stays in
  component tree — no Redux/MobX. Fetch via native `fetch()`.
- **Design direction:** editorial/minimal. Serif display font for the main headline,
  clean sans-serif for body, strong accent color, generous negative space. NOT a generic
  purple-gradient landing page.
- **Deployment target:** local dev only for this sprint. No Docker, no CI/CD.
- **Scope discipline:** one feature end-to-end. No auth, no custom aliases, no QR codes,
  no rate limiting, no expiration. Those come later.

## Architecture

Two independent modules in a monorepo layout:

```
apps/api/              # Fastify backend
  src/
    server.ts          # Fastify bootstrap, plugin registration
    routes/
      shorten.ts       # POST /api/shorten
      redirect.ts      # GET /:code
      stats.ts         # GET /api/stats
    db/
      schema.sql       # urls table
      client.ts        # better-sqlite3 wrapper
    lib/
      code-generator.ts # short code generation logic
  data/
    urls.db            # gitignored, created at runtime
  tests/
    routes.test.ts
    code-generator.test.ts

apps/web/              # React frontend
  src/
    App.tsx            # top-level layout
    components/
      ui/              # designer territory — styled primitives
        Button.tsx
        Input.tsx
        Card.tsx
      ShortenForm.tsx  # form to submit URL, frontend territory
      LinkList.tsx     # list of shortened URLs with click counts
      StatsBar.tsx     # total clicks, total links
    hooks/
      useShortener.ts  # useMutation-style hook for POST /api/shorten
      useLinks.ts      # useQuery-style hook for GET /api/stats
    lib/
      api.ts           # typed fetch wrappers
    styles/
      globals.css      # design tokens, Tailwind base
  index.html
  vite.config.ts
  tests/
    App.test.tsx

package.json           # workspaces
pnpm-workspace.yaml
```

## Data model

SQLite table:

```sql
CREATE TABLE urls (
  code        TEXT PRIMARY KEY,              -- 7-char base62 code
  original    TEXT NOT NULL,                 -- original URL
  created_at  INTEGER NOT NULL,              -- unix seconds
  click_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_urls_created_at ON urls(created_at DESC);
```

Short code generation:
- 7 chars, alphabet `[a-zA-Z0-9]` (62 chars → 62^7 ≈ 3.5 trillion combinations)
- Generated randomly via `crypto.randomBytes` → base62 encoded
- On collision, retry (practically never happens at this scale)
- Reject codes starting with digit only (reserved for future pagination routes)

## API

All responses JSON. All requests validated via Fastify JSON Schema.

### `POST /api/shorten`

Request:
```json
{ "url": "https://example.com/very/long/path?with=params" }
```

Validation:
- `url` is required, must be a valid URL (http:// or https://)
- Max length 2048
- Reject URLs pointing at the shortener's own domain (prevent recursive loops)

Response 200:
```json
{
  "code": "a9Kz3xQ",
  "shortUrl": "http://localhost:3000/a9Kz3xQ",
  "original": "https://example.com/very/long/path?with=params",
  "createdAt": 1744488000
}
```

Errors:
- 400 `{ "error": "invalid_url", "message": "..." }` — validation failed
- 400 `{ "error": "self_reference" }` — URL is the shortener itself
- 500 `{ "error": "internal" }` — DB or code-generation error

### `GET /:code`

302 redirect to `original`. Increments `click_count` atomically. If code not found,
returns 404 with plain HTML message (not JSON — browser will see it).

### `GET /api/stats`

Response 200:
```json
{
  "total_links": 42,
  "total_clicks": 187,
  "links": [
    { "code": "a9Kz3xQ", "original": "...", "clicks": 12, "createdAt": 1744488000 },
    ...
  ]
}
```

Returns the 50 most recently created links, sorted by `createdAt DESC`.

## UI flows

### Main page (single page app)

Layout (top to bottom):
1. **Hero**: editorial headline ("shorten. share. track."), subheadline, generous space
2. **ShortenForm**: single input (URL) + "Shorten" button. On submit, shows loading state, then reveals the short URL with copy-to-clipboard button.
3. **StatsBar**: "42 links created · 187 total clicks" — live from `/api/stats`
4. **LinkList**: recent 50 links with original (truncated), short code, click count,
   created time (relative like "3 min ago"). Each row has its own copy button.

Empty state for LinkList: "No links yet — shorten your first URL above."

### Error states

- Invalid URL → inline error under the input: "That doesn't look like a valid URL"
- Self-reference → inline error: "Can't shorten a link to this shortener"
- Network error → toast at bottom: "Couldn't reach the server. Try again."
- 404 on redirect → browser sees plain HTML page: "Link not found"

### Design direction (designer-agent territory)

- **Typography**: serif display (e.g. Fraunces, PP Editorial New, or similar distinctive
  serif — NOT Times New Roman, NOT Inter). Body: refined sans-serif (Söhne, Geist, or
  system-ui if nothing else). Never use default Tailwind fonts.
- **Colors**: dark mode first. Background near-black (not pure #000), foreground near-white.
  ONE strong accent color for the button and links (e.g. amber, lime, electric blue — pick
  something unexpected, not generic purple or Tailwind blue-500).
- **Spacing**: generous. 8-column grid with wide margins on desktop. Single column on mobile.
- **Components**: minimal, no borders by default. Input has a subtle underline that glows
  on focus in accent color. Button is flat, no gradient, with a crisp hover state.
- **Motion**: subtle fade-in on load. Stagger the hero, form, stats, list by 80ms each.
  Copy button shows a quick checkmark pulse on click.
- **Do NOT use**: drop shadows, gradients, rounded-full buttons, generic card patterns,
  Inter font, purple-to-pink gradients, emoji sparkles. If the result looks like a ChatGPT
  landing page clone, reject and redo.

## Error handling

Backend:
- All DB operations wrapped in try/catch with typed errors
- Fastify error handler returns structured JSON for all 4xx/5xx
- Never expose stack traces or internal errors to clients
- Log errors via pino with request ID

Frontend:
- Every fetch wrapped, returns `{ data, error }` tuple
- User-facing errors shown inline or as toast, never console.error
- Network errors have retry prompt
- Never crash the UI — always show something useful

## Testing strategy

### Backend tests (`apps/api/tests/`)

- **code-generator.test.ts** (unit)
  - Generates 7-char base62 strings
  - Rejects first-digit codes
  - Handles collision (mock DB, return existing code first time, new second time)
- **routes.test.ts** (integration, via Fastify `inject`)
  - `POST /api/shorten` with valid URL → returns 200 with code + shortUrl
  - `POST /api/shorten` with invalid URL → returns 400
  - `POST /api/shorten` with self-reference → returns 400
  - `GET /:code` with existing code → returns 302 + increments click_count
  - `GET /:code` with non-existent code → returns 404
  - `GET /api/stats` returns total counts + list
  - `GET /api/stats` with empty DB returns zeros + empty list

### Frontend tests (`apps/web/tests/`)

- **App.test.tsx** (React Testing Library + vitest)
  - Renders hero headline
  - Submit valid URL → shows short URL in result area
  - Submit invalid URL → shows inline error
  - LinkList renders recent links from stats API (mocked)
  - Copy button on short URL result area works (mock clipboard API)
  - Empty state shown when no links

### End-to-end smoke test

A single test that starts the API server + a client, shortens a URL, follows the redirect,
and verifies click_count incremented. Done with Playwright (optional — can defer to v2).

## Acceptance criteria

- [ ] `pnpm install` then `pnpm --filter api dev` starts Fastify on port 3000
- [ ] `pnpm --filter web dev` starts Vite on port 5173
- [ ] `POST http://localhost:3000/api/shorten` with valid URL returns a 7-char code
- [ ] Visiting `http://localhost:3000/{code}` in a browser redirects to original
- [ ] `click_count` increments on each visit
- [ ] Frontend at `http://localhost:5173` shows hero, form, stats, and link list
- [ ] Frontend successfully shortens a URL end-to-end via the API
- [ ] Invalid URLs show inline errors without crashing
- [ ] All backend tests pass (minimum 8 tests covering the cases above)
- [ ] All frontend tests pass (minimum 5 tests)
- [ ] Design is NOT generic AI slop — passes designer review against the design direction above
- [ ] No console errors in browser, no unhandled rejections in server logs
- [ ] `.gitignore` excludes `data/urls.db` and `node_modules/`

## Out of scope

Explicitly NOT part of this sprint:
- User authentication or accounts
- Custom short codes or aliases
- QR code generation
- Expiration / TTL
- Rate limiting (beyond basic Fastify defaults)
- Analytics beyond total click count (no per-day, per-referrer, per-country)
- Dark/light mode toggle (dark only for now)
- Mobile responsive polish beyond basic layout
- Dockerfile / deployment config
- CI/CD pipeline
- Custom domain support
- API key authentication
- Bulk shortening
- Link editing or deletion
- Social sharing integrations

Any of these requires a new sprint with its own spec.

## Open questions

- **Port conflict**: if the user already has something on 3000 or 5173, how to signal?
  Decision needed at implementation time — probably let Fastify/Vite error out clearly.
- **Code length**: 7 chars is a magic number. Should it be configurable via env? Defer — hardcode for now.
- **Database location**: `apps/api/data/urls.db` is project-local. For a real deploy this
  would go somewhere else, but for this sprint keep it simple.

## Roles involved

| Role | Responsibility | Files |
|---|---|---|
| `designer-agent` | Design tokens, styled UI primitives (Button, Input, Card), typography, color system | `apps/web/src/components/ui/`, `apps/web/src/styles/globals.css`, `tailwind.config.ts` |
| `frontend-agent` | App logic, hooks, fetch wrappers, components that use design primitives | `apps/web/src/App.tsx`, `apps/web/src/components/{ShortenForm,LinkList,StatsBar}.tsx`, `apps/web/src/hooks/`, `apps/web/src/lib/` |
| `nodejs-agent` | Fastify server, routes, SQLite wrapper, code generator | `apps/api/src/`, `apps/api/tests/` |

Expected wave layout:

- **Wave 1** (parallel):
  - designer-agent: design tokens + UI primitives + typography/color system
  - nodejs-agent: backend (server, routes, db, code-generator, tests)
- **Wave 2** (depends on wave 1):
  - frontend-agent: ShortenForm, LinkList, StatsBar, App — uses designer's primitives
    and nodejs's API
- **Wave 3** (depends on wave 2):
  - designer-agent (review mode): visual audit of composed UI against design direction
