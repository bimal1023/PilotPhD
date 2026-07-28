from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from ..config import settings
from ..models.application import Application, ApplicationStatus
from .llm import client


async def generate_daily_briefing(db: Session, user_id: int) -> str:
    now = datetime.now()
    today = now.date()
    hour = now.hour
    if hour < 12:
        greeting = "Good Morning"
    elif hour < 17:
        greeting = "Good Afternoon"
    else:
        greeting = "Good Evening"
    two_weeks = today + timedelta(days=14)

    all_apps = db.query(Application).filter(Application.user_id == user_id).all()

    upcoming_deadlines = [
        app for app in all_apps
        if app.deadline and today <= app.deadline <= two_weeks
    ]

    in_progress = [
        app for app in all_apps
        if app.status in [
            ApplicationStatus.APPLIED,
            ApplicationStatus.WAITING
        ]
    ]

    planning = [
        app for app in all_apps
        if app.status == ApplicationStatus.PLANNING
    ]

    briefing_data = f"""
    Today: {today}

    UPCOMING DEADLINES (next 14 days):
    {chr(10).join([f"- {app.university} ({app.program}): {app.deadline}" for app in upcoming_deadlines]) or "None"}

    IN PROGRESS:
    {chr(10).join([f"- {app.university}: {app.status.value}" for app in in_progress]) or "None"}

    STILL PLANNING:
    {chr(10).join([f"- {app.university} ({app.program})" for app in planning]) or "None"}
    """

    response = await client.chat.completions.create(
        model=settings.openai_model,
        max_completion_tokens=1024,
        messages=[
            {
                "role": "system",
                "content": f"""You are a personal PhD application coach giving a briefing.
        Be concise, motivating, and specific.
        Structure your response as:
        ## {greeting} — Here's Your PhD Focus for Today
        ### Urgent (do today)
        ### This Week
        ### Overall Progress
        End with one sentence of encouragement."""
            },
            {
                "role": "user",
                "content": f"Generate my daily PhD application briefing:\n{briefing_data}"
            }
        ]
    )
    return response.choices[0].message.content
