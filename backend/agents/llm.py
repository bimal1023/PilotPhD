import json
import re

from openai import AsyncOpenAI

from ..config import settings

client = AsyncOpenAI(api_key=settings.openai_api_key)


def parse_json(text: str):
    """Parse a model response that is supposed to be pure JSON.

    Models wrap JSON in ```json fences often enough that json.loads alone is
    unreliable, so strip them first. Raises ValueError on anything unparseable
    — callers decide whether to fall back.
    """
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Model did not return valid JSON: {exc}") from exc
