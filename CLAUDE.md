# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: PilotPhD

An AI-powered PhD application co-pilot. Students track applications, draft cold emails to professors, refine personal statements, discover fellowships, and find faculty advisors — all backed by Claude AI.

**Stack:** FastAPI + SQLAlchemy + PostgreSQL backend · Next.js 16 + React 19 + TypeScript + Tailwind CSS frontend · Anthropic Claude (claude-sonnet-4-20250514) · OpenAlex + Brave Search APIs

## Commands

### Backend
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in values
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
# frontend/.env.local must contain: NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev       # http://localhost:3000
npm run build
npm run lint
```

### Docker (backend only)
```bash
docker build -t pilotphd .
docker run -p 8000:8000 --env-file backend/.env pilotphd
```

## Deployment

The whole stack runs on a single EC2 instance via `infra/docker-compose.prod.yml`
— Postgres (self-hosted, no RDS), backend, frontend, and Caddy for automatic
HTTPS. `pilotphd.com` → frontend, `api.pilotphd.com` → backend. Postgres data
lives on a separate EBS volume at `/mnt/data` so it survives instance rebuilds.

See [infra/DEPLOY.md](infra/DEPLOY.md) for the full runbook. Two things that bite:
the box has limited RAM, so **build one image at a time**; and
`NEXT_PUBLIC_API_URL` is inlined into the client bundle at build time (a compose
build arg), so changing it requires rebuilding the frontend image, not a restart.

## Architecture

### Backend

`backend/main.py` — FastAPI app entry point. Registers four routers (`/api/auth`, `/api/applications`, `/api/agents`, `/api/professors`), attaches slowapi rate-limiting middleware, and runs `init_db()` on startup.

`backend/database.py` — SQLAlchemy sync engine + `Base`. `init_db()` calls `Base.metadata.create_all` then `_run_migrations()`, which applies incremental schema changes directly via raw SQL (`ALTER TABLE … IF NOT EXISTS`). No Alembic — schema evolution is handled manually here.

`backend/auth.py` — JWT helpers (HS256, 7-day expiry). `get_current_user` accepts the token from either an `HttpOnly` `session` cookie or a `Bearer` header. JWTs carry a `ver` (token version) claim validated against `users.token_version`; incrementing `token_version` invalidates all existing sessions (used on password reset).

`backend/config.py` — `pydantic-settings` `Settings` object; all env vars live here. Imported as the singleton `settings`.

**Agents** (`backend/agents/`) — Each agent is an async function called directly by the route handler:
- `email_drafter.py` — Multi-turn agentic loop (up to 6 iterations) with two Claude tools: `web_search` (Brave API) and `read_document`. Generates personalized cold emails.
- `professor_finder.py` — Queries OpenAlex for faculty candidates, then calls Claude to rank and score by fit.
- `fellowship_finder.py` — Uses Brave Search + Claude to surface funding opportunities.
- `statement_refiner.py` — Single Claude call: critique + rewrite of personal statement.
- `daily_briefing.py` — Reads upcoming deadlines/status from DB, passes to Claude for a structured morning briefing.
- `deadline_tracker.py` — Extracts urgent deadlines from DB for the `/deadline-briefing` route.

**Routes** (`backend/routes/`) — Thin handlers that validate input via Pydantic schemas (`schemas.py`), call the relevant agent, and return `{"result": ...}`. Auth routes also manage session cookies and email verification tokens.

### Frontend

Next.js App Router (`frontend/app/`). Each feature is a separate route directory (`/dashboard`, `/applications`, `/email`, `/statement`, `/fellowships`, `/professors`, `/briefing`). Auth routes: `/login`, `/register` (no dedicated page — handled via login), `/forgot-password`, `/reset-password`, `/verify-email`, `/resend-verification`.

**Auth model:** The backend sets an `HttpOnly` `session` cookie on login/verify/reset. The frontend mirrors this with a lightweight `pilotphd_logged_in=1` cookie (non-HttpOnly, used only for middleware route guards — not for API calls). `frontend/middleware.ts` redirects unauthenticated users to `/login`. API calls send `credentials: "include"` so the browser attaches the real `session` cookie automatically.

`frontend/lib/`:
- `api.ts` — exports `API_URL` from `NEXT_PUBLIC_API_URL`
- `authCookie.ts` — `setAuthCookie / clearAuthCookie / hasAuthCookie` for the frontend indicator cookie
- `applicationsCache.ts` — 30-second in-memory cache + in-flight deduplication for `GET /api/applications/`. Call `invalidateApplicationsCache()` after any mutation.
- `fetchWithTimeout.ts` — `fetch` wrapper with a configurable timeout

`frontend/components/` — `NavBar.tsx` (main nav, present on all authenticated pages), `LoadingCard.tsx` (skeleton loader).

### Key Design Decisions

- **No Alembic**: schema migrations are idempotent raw SQL in `database.py:_run_migrations()`. Add new migrations there.
- **Agents are stateless**: no DB persistence of AI results — everything is request/response.
- **Rate limiting**: slowapi on auth endpoints (register: 5/min, login: 10/min, forgot-password/resend: 3/min).
- **Docs disabled in production**: `/docs`, `/redoc`, and `/openapi.json` are hidden when `ENVIRONMENT=production`.
- **CORS**: `settings.frontend_url` (comma-separated) plus a regex allowing any `pilotphd*.vercel.app` subdomain.

## Environment Variables

### Backend (`backend/.env`)
| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Yes | |
| `SECRET_KEY` | Yes | JWT signing secret — generate with `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `RESEND_API_KEY` | Yes | Email delivery |
| `FROM_EMAIL` | No | Defaults to `onboarding@resend.dev` |
| `FRONTEND_URL` | No | Defaults to `http://localhost:3000`; comma-separate multiple origins |
| `BRAVE_API_KEY` | No | Used by email drafter and fellowship finder |
| `CLAUDE_MODEL` | No | Defaults to `claude-sonnet-4-20250514` |
| `ENVIRONMENT` | No | Set to `production` on Render |

### Frontend (`frontend/.env.local`)
| Variable | Required |
|---|---|
| `NEXT_PUBLIC_API_URL` | Yes |
