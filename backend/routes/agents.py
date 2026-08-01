import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..auth import get_current_user
from ..limiter import limiter
from ..database import get_db
from ..models.user import User
from ..schemas import EmailDraftRequest, FellowshipRequest, StatementRequest
from ..agents.email_drafter import draft_email
from ..agents.fellowship_finder import find_fellowships
from ..agents.statement_refiner import refine_statement
from ..agents.deadline_tracker import get_deadline_briefing
from ..agents.daily_briefing import generate_daily_briefing

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/draft-email")
@limiter.limit("20/hour")
async def draft_email_route(
    request: Request,
    payload: EmailDraftRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        user_documents = {
            "personal_statement": payload.personal_statement or "",
            "research_interest": payload.research_interest or ""
        }
        result = await draft_email(payload.professor_name, payload.university, user_documents)
        return {"result": result}
    except Exception as e:
        logger.error(f"draft_email failed: {e}")
        raise HTTPException(status_code=500, detail="Could not draft your email. Please try again.")


@router.post("/find-fellowships")
@limiter.limit("15/hour")
async def find_fellowships_route(
    request: Request,
    payload: FellowshipRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        result = await find_fellowships(payload.research_interest, payload.profile)
        return {"result": result}
    except Exception as e:
        logger.error(f"find_fellowships failed: {e}")
        raise HTTPException(status_code=500, detail="Could not find fellowships. Please try again.")


@router.post("/refine-statement")
@limiter.limit("20/hour")
async def refine_statement_route(
    request: Request,
    payload: StatementRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        result = await refine_statement(payload.personal_statement)
        return {"result": result}
    except Exception as e:
        logger.error(f"refine_statement failed: {e}")
        raise HTTPException(status_code=500, detail="Could not refine your statement. Please try again.")


@router.get("/deadline-briefing")
@limiter.limit("40/hour")
async def deadline_briefing_route(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        result = await get_deadline_briefing(db, current_user.id)
        return {"result": result}
    except Exception as e:
        logger.error(f"deadline_briefing failed: {e}")
        raise HTTPException(status_code=500, detail="Could not generate deadline briefing. Please try again.")


@router.get("/daily-briefing")
@limiter.limit("40/hour")
async def daily_briefing_route(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        result = await generate_daily_briefing(db, current_user.id)
        return {"result": result}
    except Exception as e:
        logger.error(f"daily_briefing failed: {e}")
        raise HTTPException(status_code=500, detail="Could not generate your briefing. Please try again.")
