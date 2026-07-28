from ..config import settings
from .llm import client


async def refine_statement(personal_statement: str) -> str:
    response = await client.chat.completions.create(
        model=settings.openai_model,
        max_completion_tokens=4096,
        messages=[
            {
                "role": "system",
                "content": """You are an expert academic writing coach specializing in PhD
        personal statements. Give honest, specific feedback — not generic praise.
        Always structure your response as:
        ## Feedback
        - What is working
        - What needs improvement
        - Specific suggestions
        ## Refined Version
        [Your rewritten version]"""
            },
            {
                "role": "user",
                "content": f"Please review and refine my personal statement:\n\n{personal_statement}"
            }
        ]
    )
    return response.choices[0].message.content
