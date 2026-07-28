from datetime import date
from sqlalchemy.orm import Session
from ..config import settings
from ..models.application import Application, ApplicationStatus
from .llm import client


async def get_deadline_briefing(db: Session, user_id: int) -> str:
    today = date.today()

    applications = db.query(Application).filter(
        Application.user_id == user_id,
        Application.status.in_([
            ApplicationStatus.PLANNING,
            ApplicationStatus.APPLIED,
            ApplicationStatus.WAITING
        ])
    ).all()

    app_data = "\n".join([
        f"- {app.university} ({app.program}): "
        f"deadline {app.deadline}, status {app.status.value}, "
        f"professors {app.professors}"
        for app in applications
    ])

    response = await client.chat.completions.create(
        model=settings.openai_model,
        max_completion_tokens=1024,
        messages=[
            {
                "role": "system",
                "content": """You are a PhD application advisor.
        Analyze the student's application deadlines and give clear,
        prioritized action items. Be specific and urgent where needed."""
            },
            {
                "role": "user",
                "content": f"Today is {today}. Here are my current applications:\n\n{app_data}\n\nWhat should I focus on and what deadlines are coming up?"
            }
        ]
    )
    return response.choices[0].message.content
