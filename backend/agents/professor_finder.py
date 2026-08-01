import asyncio
import httpx
from ..config import settings
from .llm import client, parse_json

OPENALEX_BASE = "https://api.openalex.org"
MAILTO = settings.from_email  # OpenAlex polite-pool identifier

# ── Common abbreviation map (saves one API call per well-known name) ──────────
ALIASES: dict[str, str] = {
    "MIT": "Massachusetts Institute of Technology",
    "CMU": "Carnegie Mellon University",
    "UCLA": "University of California, Los Angeles",
    "UC Berkeley": "University of California, Berkeley",
    "Berkeley": "University of California, Berkeley",
    "UCSD": "University of California, San Diego",
    "UCSB": "University of California, Santa Barbara",
    "UIUC": "University of Illinois at Urbana-Champaign",
    "NYU": "New York University",
    "UPenn": "University of Pennsylvania",
    "Columbia": "Columbia University",
    "UMich": "University of Michigan",
    "UW": "University of Washington",
    "UT Austin": "The University of Texas at Austin",
    "GaTech": "Georgia Institute of Technology",
    "Georgia Tech": "Georgia Institute of Technology",
    "Caltech": "California Institute of Technology",
    "UChicago": "University of Chicago",
    "JHU": "Johns Hopkins University",
    "Duke": "Duke University",
    "UNC": "University of North Carolina at Chapel Hill",
    "MSU": "Michigan State University",
    "Purdue": "Purdue University",
    "OSU": "Ohio State University",
}


# ── Step 0: Resolve university name → OpenAlex institution ID ────────────────

async def _resolve_institution(university: str) -> tuple[str, str]:
    """
    Return (institution_id, display_name) for a university.
    Tries the alias map first, then queries OpenAlex /institutions.
    Falls back to the original name if nothing is found.
    """
    search_name = ALIASES.get(university, university)

    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            res = await http.get(
                f"{OPENALEX_BASE}/institutions",
                params={
                    "search": search_name,
                    "per_page": 1,
                    "select": "id,display_name",
                    "mailto": MAILTO,
                },
            )
            if res.is_success:
                results = res.json().get("results", [])
                if results:
                    return results[0]["id"], results[0]["display_name"]
    except Exception:
        pass

    # Fallback — use the name directly in the filter (may still work for some)
    return "", search_name


# ── Step 1: Search works at one university on the research topic ──────────────

async def _search_university(research_interest: str, university: str) -> list[dict]:
    """Find authors at one university publishing on the research topic."""
    institution_id, display_name = await _resolve_institution(university)

    # Build the filter — institution ID is more reliable than display name
    if institution_id:
        inst_filter = f"authorships.institutions.id:{institution_id}"
    else:
        inst_filter = f"authorships.institutions.display_name:{display_name}"

    params = {
        "search": research_interest,
        "filter": inst_filter,
        "sort": "cited_by_count:desc",
        "per_page": 20,
        "select": "id,title,authorships,cited_by_count,publication_year",
        "mailto": MAILTO,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as http:
            res = await http.get(f"{OPENALEX_BASE}/works", params=params)
            if not res.is_success:
                return []
            works = res.json().get("results", [])
    except Exception:
        return []

    seen: set[str] = set()
    authors: list[dict] = []

    for work in works:
        for authorship in work.get("authorships", []):
            author = authorship.get("author", {})
            author_id = author.get("id", "")
            if not author_id or author_id in seen:
                continue

            # Confirm this authorship is at the target institution
            inst_ids = [i.get("id", "") for i in authorship.get("institutions", [])]
            inst_names = [i.get("display_name", "") for i in authorship.get("institutions", [])]

            at_target = (
                (institution_id and institution_id in inst_ids)
                or any(display_name.lower() in n.lower() for n in inst_names)
                or any(university.lower() in n.lower() for n in inst_names)
            )
            if not at_target:
                continue

            seen.add(author_id)
            # Use the resolved display name for consistency
            affil_name = next(
                (n for n in inst_names if display_name.lower() in n.lower() or university.lower() in n.lower()),
                display_name or university,
            )
            authors.append({
                "id": author_id,
                "name": author.get("display_name", "Unknown"),
                "university": affil_name,
                "recent_paper": work.get("title", ""),
                "paper_citations": work.get("cited_by_count", 0),
                "paper_year": work.get("publication_year"),
            })

    return authors


# ── Step 2: Enrich one author with stats + top papers ────────────────────────

async def _enrich_author(candidate: dict) -> dict:
    """Fetch citation count, h-index, and top 3 papers from OpenAlex."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            res = await http.get(candidate["id"], params={"mailto": MAILTO})
            if not res.is_success:
                raise ValueError("author fetch failed")
            details = res.json()

        candidate["citation_count"] = details.get("cited_by_count", 0)
        candidate["h_index"] = details.get("summary_stats", {}).get("h_index")
        candidate["openalex_url"] = details.get("id", "")

        works_url = details.get("works_api_url", "")
        if works_url:
            async with httpx.AsyncClient(timeout=10.0) as http:
                wres = await http.get(
                    works_url,
                    params={
                        "sort": "cited_by_count:desc",
                        "per_page": 3,
                        "select": "title,publication_year",
                        "mailto": MAILTO,
                    },
                )
                if wres.is_success:
                    works = wres.json().get("results", [])
                    candidate["top_papers"] = [
                        f"{w['title']} ({w.get('publication_year', '')})"
                        for w in works
                    ]
                else:
                    candidate["top_papers"] = (
                        [candidate["recent_paper"]] if candidate.get("recent_paper") else []
                    )
        else:
            candidate["top_papers"] = (
                [candidate["recent_paper"]] if candidate.get("recent_paper") else []
            )

    except Exception:
        candidate.setdefault("citation_count", candidate.get("paper_citations", 0))
        candidate.setdefault("h_index", None)
        candidate.setdefault("openalex_url", "")
        candidate.setdefault(
            "top_papers",
            [candidate["recent_paper"]] if candidate.get("recent_paper") else [],
        )

    return candidate


# ── Step 3: Find email via Brave Search + Claude extraction ──────────────────

async def _find_email(name: str, university: str) -> dict:
    """Search the web for a professor's publicly listed email."""
    if not settings.brave_api_key:
        return {"email": None, "source": None}

    query = f'"{name}" {university} professor email contact'
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            res = await http.get(
                "https://api.search.brave.com/res/v1/web/search",
                headers={
                    "Accept": "application/json",
                    "X-Subscription-Token": settings.brave_api_key,
                },
                params={"q": query, "count": 5},
            )
            if not res.is_success:
                return {"email": None, "source": None}
            results = res.json().get("web", {}).get("results", [])
    except Exception:
        return {"email": None, "source": None}

    if not results:
        return {"email": None, "source": None}

    context = "\n\n".join([
        f"URL: {r['url'][:200]}\nText: {r['description'][:400]}"
        for r in results
    ])

    try:
        response = await client.chat.completions.create(
            model=settings.openai_model,
            max_completion_tokens=150,
            messages=[
                {
                    "role": "system",
                    "content": """Extract a professor's institutional email from the search results.
Return ONLY valid JSON: {"email": "name@university.edu", "source": "https://page-url"}
If no real email address is visible in the text, return: {"email": null, "source": "https://first-result-url"}
NEVER invent, guess, or construct an email address.""",
                },
                {
                    "role": "user",
                    "content": f"Find email for Professor {name} at {university}:\n\n{context}",
                },
            ],
        )
        return parse_json(response.choices[0].message.content)
    except Exception:
        return {"email": None, "source": results[0]["url"] if results else None}


# ── Step 4: the model ranks all candidates by fit ────────────────────────────

async def _rank_by_fit(
    candidates: list[dict],
    research_interest: str,
    profile: str,
) -> list[dict]:
    """Ask the model to score and explain each professor's fit."""
    summaries = "\n\n".join([
        f"Professor {i}: {c['name']} at {c['university']}\n"
        f"Citations: {c.get('citation_count', 0)} | H-index: {c.get('h_index', 'N/A')}\n"
        f"Top papers: {'; '.join(c.get('top_papers', [])[:3])}"
        for i, c in enumerate(candidates)
    ])

    try:
        response = await client.chat.completions.create(
            model=settings.openai_model,
            max_completion_tokens=2500,
            messages=[
                {
                    "role": "system",
                    "content": """You are a PhD admissions advisor ranking professors by research fit.
Return ONLY a JSON array — no markdown, no text outside the JSON:
[
  {
    "index": 0,
    "fit_score": 88,
    "why": "2-3 sentence explanation connecting their work to the student's background",
    "email_talking_point": "One specific detail from their papers to mention in a cold email"
  }
]
Score range: 55–99. Be honest — not everyone is a great match.
Base scores solely on alignment between the professor's papers and the student's stated interest and profile.""",
                },
                {
                    "role": "user",
                    "content": (
                        f"Research interest: {research_interest}\n\n"
                        f"Student profile: {profile}\n\n"
                        f"Professors to rank:\n{summaries}"
                    ),
                },
            ],
        )
        return parse_json(response.choices[0].message.content)
    except Exception:
        return [
            {"index": i, "fit_score": 70, "why": "Relevant research area.", "email_talking_point": ""}
            for i in range(len(candidates))
        ]


# ── Main entry point ──────────────────────────────────────────────────────────

async def find_professors(
    research_interest: str,
    universities: list[str],
    profile: str,
) -> list[dict]:
    # 1. Search all universities in parallel
    search_results = await asyncio.gather(
        *[_search_university(research_interest, u) for u in universities]
    )
    all_candidates: list[dict] = [c for sublist in search_results for c in sublist]

    if not all_candidates:
        return []

    # 2. Deduplicate, keep top 12 by paper citation count
    seen: set[tuple] = set()
    unique: list[dict] = []
    for c in sorted(all_candidates, key=lambda x: x["paper_citations"], reverse=True):
        key = (c["name"].lower(), c["university"].lower())
        if key not in seen:
            seen.add(key)
            unique.append(c)

    top12 = unique[:12]

    # 3. Enrich all 12 in parallel
    enriched = list(await asyncio.gather(*[_enrich_author(c) for c in top12]))

    # 4. Claude ranks by fit
    rankings = await _rank_by_fit(enriched, research_interest, profile)
    rankings_sorted = sorted(rankings, key=lambda x: x.get("fit_score", 0), reverse=True)

    # 5. Find emails for top 6 in parallel
    top6_indices = [r["index"] for r in rankings_sorted[:6] if r["index"] < len(enriched)]
    email_results = await asyncio.gather(
        *[_find_email(enriched[i]["name"], enriched[i]["university"]) for i in top6_indices]
    )
    for idx, email_data in zip(top6_indices, email_results):
        enriched[idx]["email"] = email_data.get("email")
        enriched[idx]["email_source"] = email_data.get("source")

    # 6. Assemble final sorted results
    results: list[dict] = []
    for rank_info in rankings_sorted:
        idx = rank_info["index"]
        if idx >= len(enriched):
            continue
        c = enriched[idx]
        results.append({
            "name": c["name"],
            "university": c["university"],
            "fit_score": rank_info.get("fit_score", 70),
            "why": rank_info.get("why", ""),
            "email_talking_point": rank_info.get("email_talking_point", ""),
            "email": c.get("email"),
            "email_source": c.get("email_source"),
            "top_papers": c.get("top_papers", []),
            "citation_count": c.get("citation_count", 0),
            "h_index": c.get("h_index"),
            "openalex_url": c.get("openalex_url", ""),
        })

    return results
