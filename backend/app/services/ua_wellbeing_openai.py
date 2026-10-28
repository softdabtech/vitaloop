from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional

import httpx

from app.config import settings
from app.services import supabase_service as svc

logger = logging.getLogger(__name__)

_client: Optional[httpx.AsyncClient] = None

_SYSTEM_PROMPT = (
    "You are VITALOOP Ukraine, a symptom-first wellness education assistant. "
    "Return only valid JSON in Ukrainian. Do not diagnose, prescribe treatment, "
    "promise outcomes, mention patriotism, or claim a medical conclusion. "
    "Frame everything as possible directions to discuss with a qualified clinician."
)

_USER_PROMPT_TMPL = """A visitor on the Ukrainian VITALOOP website completed a short wellbeing assessment.

Symptoms/signals: {symptoms}
Duration: {duration}
Intensity: {intensity}/5
Context: {context}
Age range: {age_range}
Family context: {family_context}

Generate a concise Ukrainian result for a modal window.
Return JSON with exactly these keys:
{{
  "headline": "short headline, max 90 chars",
  "priority_level": "stable | watch | attention",
  "summary": "2 short sentences explaining what the pattern may suggest",
  "possible_links": ["2-4 symptom connections, each max 90 chars"],
  "lab_directions": [
    {{"name": "marker/category", "reason": "why it may be relevant, max 100 chars"}}
  ],
  "doctor_questions": ["2-4 questions to ask a doctor, each max 110 chars"],
  "next_steps": ["2-4 practical next steps, each max 100 chars"],
  "disclaimer": "short educational disclaimer"
}}

Use Ukrainian lab names when natural, for example: ЗАК, феритин, 25(OH)D, B12, TSH, CRP.
Do not recommend urgent care unless the provided context clearly suggests danger.
If information is limited, say that the result is a starting map, not a conclusion."""


def _is_openai_configured() -> bool:
    return bool((settings.active_llm_api_key or "").strip())


def _get_openai_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        api_key = settings.active_llm_api_key
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured.")
        _client = httpx.AsyncClient(
            base_url=(settings.active_llm_base_url or "https://api.openai.com/v1").rstrip("/"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )
    return _client


def _strip_code_block(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
    return raw.strip()


async def _persist_openai_usage(payload: Dict[str, Any]) -> None:
    try:
        usage = payload.get("usage") or {}
        prompt_tokens = int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
        completion_tokens = int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
        total_tokens = int(usage.get("total_tokens") or (prompt_tokens + completion_tokens))
        if prompt_tokens <= 0 and completion_tokens <= 0 and total_tokens <= 0:
            return

        row = {
            "task_name": "ua_wellbeing_assessment",
            "provider": "openai",
            "model": str(payload.get("model") or settings.active_llm_model or "unknown"),
            "user_id": None,
            "upload_id": None,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "meta": {"response_id": payload.get("id"), "surface": "ua_public_modal"},
        }
        sb = svc._get_supabase()
        await svc._run(lambda: sb.table("llm_usage_events").insert(row).execute())
    except Exception as ex:
        logger.warning("ua_wellbeing_openai_usage_failed reason=%s", ex)


async def generate_ua_wellbeing_assessment(
    *,
    symptoms: List[str],
    duration: str,
    intensity: int,
    context: str | None = None,
    age_range: str | None = None,
    family_context: str | None = None,
) -> Optional[Dict[str, Any]]:
    """Generate a Ukrainian public wellbeing assessment with OpenAI-compatible chat completions."""
    if not _is_openai_configured():
        return None

    prompt = _USER_PROMPT_TMPL.format(
        symptoms=", ".join(symptoms) if symptoms else "не вказано",
        duration=duration or "не вказано",
        intensity=intensity,
        context=(context or "").strip() or "не вказано",
        age_range=age_range or "не вказано",
        family_context=family_context or "не вказано",
    )

    try:
        response = await asyncio.wait_for(
            _get_openai_client().post(
                "chat/completions",
                json={
                    "model": settings.active_llm_model,
                    "temperature": 0.25,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                },
            ),
            timeout=20.0,
        )
        response.raise_for_status()
        payload = response.json()
        await _persist_openai_usage(payload)
        choices = payload.get("choices") or []
        content = ((choices[0] or {}).get("message") or {}).get("content", "")
        parsed = json.loads(_strip_code_block(content))
        return parsed if isinstance(parsed, dict) else None
    except Exception as ex:
        logger.warning("ua_wellbeing_openai_failed reason=%s", ex)
        return None
