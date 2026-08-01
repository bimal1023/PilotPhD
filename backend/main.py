from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from sqlalchemy import text
from .config import settings
from .database import init_db, get_db
from .limiter import limiter
from .routes import applications, agents, auth, professors


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="PilotPhD API",
    description="Personal PhD application assistant",
    version="0.1.0",
    lifespan=lifespan,
    # Disable interactive docs in production
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(
    RateLimitExceeded,
    lambda request, exc: JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please wait a moment and try again."},
    ),
)

app.add_middleware(
    CORSMiddleware,
    # Explicit allowlist only. A regex over *.vercel.app used to live here; since
    # vercel.app is a public suffix, anyone could register a matching subdomain
    # and be granted a credentialed cross-origin response.
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(applications.router, prefix="/api/applications", tags=["applications"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
app.include_router(professors.router, prefix="/api/professors", tags=["professors"])


@app.get("/health")
def health(db=Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
