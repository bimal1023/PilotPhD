# PilotPhD

**Your AI-powered PhD application co-pilot.** PilotPhD helps graduate school applicants stay organized, write better outreach emails, refine personal statements, discover fellowships, and find potential faculty advisors — all in one place.

---

## Features

- **Application Tracker** — Create and manage PhD applications with status, deadlines, professors, and research interests.
- **Email Drafter** — Generate personalized cold emails to professors using OpenAI models, researching their work automatically.
- **Statement Refiner** — Get structured critique and a rewritten draft of your personal statement.
- **Fellowship Finder** — Discover funding opportunities (NSF GRFP, NDSEG, Hertz, Ford, and more) tailored to your research profile.
- **Professor Finder** — Search faculty across universities via OpenAlex, ranked by AI for fit with your research interests.
- **Daily Briefing** — AI-generated morning summary of urgent items, upcoming deadlines, and application progress.
- **Authentication** — Email/password login with JWT sessions, email verification, and password reset.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy, PostgreSQL |
| AI | OpenAI (gpt-5.6-terra) |
| Research APIs | OpenAlex, Brave Search |
| Email | Resend |
| Deployment | Docker (backend), Vercel (frontend) |

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL database
- OpenAI API key
- (Optional) Brave Search API key, Resend API key

### Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

Copy the environment template and fill in your values:

```bash
cp .env.example .env
```

Start the API server:

```bash
uvicorn main:app --reload --port 8000
```

The backend runs at `http://localhost:8000`. Database tables are created automatically on startup.

### Frontend

```bash
cd frontend
npm install
```

Create a local environment file:

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the dev server:

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

---

## Environment Variables

### Backend (`.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `SECRET_KEY` | Yes | JWT signing secret (random string) |
| `FRONTEND_URL` | Yes | Frontend origin for CORS (e.g. `http://localhost:3000`) |
| `BRAVE_API_KEY` | No | Brave Search API key (Fellowship Finder) |
| `RESEND_API_KEY` | No | Resend API key (email verification & password reset) |
| `OPENAI_MODEL` | No | OpenAI model ID (default: `gpt-5.6-terra`) |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Backend base URL |

---

## Docker

Build and run the backend with Docker:

```bash
docker build -t pilotphd .
docker run -p 8000:8000 --env-file .env pilotphd
```

---

## API Overview

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Login and receive JWT |
| `POST` | `/api/auth/logout` | Invalidate session |
| `POST` | `/api/auth/forgot-password` | Request password reset email |
| `POST` | `/api/auth/reset-password` | Set new password via token |
| `GET` | `/api/applications/` | List user's applications |
| `POST` | `/api/applications/` | Create application |
| `PATCH` | `/api/applications/{id}` | Update application |
| `DELETE` | `/api/applications/{id}` | Delete application |
| `POST` | `/api/agents/draft-email` | Generate professor email |
| `POST` | `/api/agents/refine-statement` | Critique and refine personal statement |
| `POST` | `/api/agents/find-fellowships` | Discover fellowships |
| `GET` | `/api/agents/daily-briefing` | Generate daily summary |
| `GET` | `/api/agents/deadline-briefing` | Extract upcoming deadlines |
| `POST` | `/api/professors/search` | Search and rank faculty by fit |
| `GET` | `/health` | Health check |

---

## Project Structure

```
pilotphd/
├── backend/
│   ├── main.py               # FastAPI app, router registration
│   ├── config.py             # Environment-based settings
│   ├── database.py           # SQLAlchemy engine, session, auto-migrate
│   ├── auth.py               # JWT helpers, password hashing
│   ├── schemas.py            # Pydantic request/response models
│   ├── models/               # SQLAlchemy ORM models
│   │   ├── user.py
│   │   └── application.py
│   ├── routes/               # API route handlers
│   │   ├── auth.py
│   │   ├── applications.py
│   │   ├── agents.py
│   │   └── professors.py
│   └── agents/               # AI feature implementations
│       ├── email_drafter.py
│       ├── statement_refiner.py
│       ├── fellowship_finder.py
│       ├── daily_briefing.py
│       ├── deadline_tracker.py
│       └── professor_finder.py
└── frontend/
    ├── app/                  # Next.js App Router pages
    │   ├── page.tsx          # Landing page
    │   ├── dashboard/
    │   ├── applications/
    │   ├── email/
    │   ├── statement/
    │   ├── fellowships/
    │   ├── professors/
    │   └── briefing/
    ├── components/           # Shared UI components
    └── lib/                  # API client, auth cookies, cache helpers
```

---

## License

MIT
