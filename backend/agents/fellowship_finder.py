import json
import httpx
from datetime import date
from ..config import settings
from .llm import client

tools = [
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search for PhD fellowships, grants, and funding opportunities",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query"
                    }
                },
                "required": ["query"]
            }
        }
    }
]

SYSTEM_PROMPT = """You are a fellowship research assistant. Your job is to find as many
relevant PhD funding opportunities as you can — breadth matters more than brevity.

Rules:
- Run up to 6 searches, varying the angle each time: by field, by citizenship or
  demographic eligibility, by funder type (federal agency, private foundation,
  professional society, university-specific), and by award stage (pre-doctoral,
  dissertation completion, travel/conference).
- Aim for 12-20 distinct fellowships. Do not stop at three or four.
- After your searches, write the final answer — do not search again.
- For each fellowship give: name, deadline, brief eligibility, award amount if
  stated, and the application link.
- Only include fellowships with future deadlines.
- Never invent a fellowship, deadline, amount, or link. Use only what appears in
  the search results; omit any field the results do not state."""


async def execute_search(query: str) -> str:
    async with httpx.AsyncClient() as http_client:
        response = await http_client.get(
            "https://api.search.brave.com/res/v1/web/search",
            headers={
                "Accept": "application/json",
                "X-Subscription-Token": settings.brave_api_key
            },
            params={"q": query, "count": 10}
        )
        results = response.json().get("web", {}).get("results", [])
        return "\n".join([
            f"Title: {r['title']}\nURL: {r['url']}\nSummary: {r['description']}"
            for r in results
        ])


async def find_fellowships(research_interest: str, profile: str) -> str:
    today = date.today().isoformat()

    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT
        },
        {
            "role": "user",
            "content": f"""Today's date is {today}.

Find PhD fellowships and grants for a student with these research interests: {research_interest}

Student profile: {profile}

Only include fellowships with deadlines on or after {today}."""
        }
    ]

    iterations = 0
    while iterations < 8:
        response = await client.chat.completions.create(
            model=settings.openai_model,
            # Was 1024 — that alone truncated the list to a handful of entries.
            max_completion_tokens=4096,
            tools=tools,
            # Required: gpt-5.6 rejects function tools in /v1/chat/completions
            # unless reasoning is off ("Function tools with reasoning_effort are
            # not supported"). The alternative is porting to /v1/responses.
            reasoning_effort="none",
            messages=messages
        )

        choice = response.choices[0]

        if choice.finish_reason == "stop":
            if not choice.message.content:
                raise ValueError("Empty response from the model")
            return choice.message.content

        if choice.finish_reason == "tool_calls":
            iterations += 1
            # The assistant message carrying the tool_calls must be echoed back
            # before the results, or the follow-up request is rejected.
            messages.append(choice.message)

            for call in choice.message.tool_calls:
                tool_input = json.loads(call.function.arguments)
                result = await execute_search(tool_input["query"])
                messages.append({
                    "role": "tool",
                    "tool_call_id": call.id,
                    "content": result
                })
        else:
            raise ValueError(f"Unexpected finish reason: {choice.finish_reason}")

    raise ValueError("Fellowship search exceeded maximum iterations")
