import json
import logging
import time
from pathlib import Path
from typing import List, Dict, Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings

_client: httpx.AsyncClient | None = None

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
EXTRACT_PROMPT = (_PROMPTS_DIR / "extract_biomarkers.txt").read_text()
PROTOCOL_PROMPT = (_PROMPTS_DIR / "generate_protocol.txt").read_text()
EXTRACT_PROMPT_VERSION = "extract_v1"
PROTOCOL_PROMPT_VERSION = "protocol_v1"

logger = logging.getLogger("uvicorn.error")

_BIOMARKER_KEYS = {"name", "value", "unit", "status"}
_PROTOCOL_KEYS = {"supplement", "dosage", "timing", "priority", "rationale", "iherb_search"}
_SYSTEM_PROMPT = (
    "You are a precise health data assistant. "
    "Return only valid JSON matching the requested schema. "
    "Do not include markdown, commentary, or code fences."
)


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        base_url = settings.active_abacus_ai_base_url.rstrip("/")
        api_key = settings.active_abacus_ai_api_key
        if not api_key:
            raise RuntimeError("ABACUS_AI_API_KEY is not configured.")
        _client = httpx.AsyncClient(
            base_url=base_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=90.0,
        )
    return _client


def _strip_code_block(raw: str) -> str:
    """Remove ```json ... ``` wrapper if Claude adds one."""
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        # Drop first line (```json or ```) and last line (```)
        raw = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
    return raw.strip()


async def _chat_completion(prompt: str, *, task_name: str) -> str:
    client = _get_client()
    model = settings.active_abacus_ai_model
    started = time.perf_counter()
    logger.info(
        "abacus_request_start",
        extra={
            "task": task_name,
            "base_url": settings.active_abacus_ai_base_url,
            "model": model,
        },
    )
    response = await client.post(
        "/chat/completions",
        json={
            "model": model,
            "temperature": 0,
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        },
    )
    response.raise_for_status()
    payload = response.json()
    choices = payload.get("choices") or []
    if not choices:
        raise ValueError("Abacus API returned no choices")
    content = ((choices[0] or {}).get("message") or {}).get("content")
    if not isinstance(content, str) or not content.strip():
        raise ValueError("Abacus API returned empty content")
    logger.info(
        "abacus_request_ok",
        extra={
            "task": task_name,
            "model": model,
            "duration_ms": int((time.perf_counter() - started) * 1000),
        },
    )
    return content


def _validate_biomarker_payload(payload: Any) -> List[Dict[str, Any]]:
    if not isinstance(payload, list):
        raise ValueError("Claude biomarker payload must be a list")
    for item in payload:
        if not isinstance(item, dict):
            raise ValueError("Biomarker item must be an object")
        missing = _BIOMARKER_KEYS - set(item.keys())
        if missing:
            raise ValueError(f"Biomarker item missing keys: {sorted(missing)}")
    return payload


def _validate_protocol_payload(payload: Any) -> List[Dict[str, Any]]:
    if not isinstance(payload, list):
        raise ValueError("Claude protocol payload must be a list")
    for item in payload:
        if not isinstance(item, dict):
            raise ValueError("Protocol item must be an object")
        missing = _PROTOCOL_KEYS - set(item.keys())
        if missing:
            raise ValueError(f"Protocol item missing keys: {sorted(missing)}")
    return payload


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def extract_biomarkers(text: str, symptoms: List[str]) -> List[Dict[str, Any]]:
    started = time.perf_counter()
    symptoms_str = ", ".join(symptoms) if symptoms else "none reported"
    prompt = EXTRACT_PROMPT.replace("{lab_text}", text).replace("{symptoms}", symptoms_str)

    raw = _strip_code_block(await _chat_completion(prompt, task_name="extract_biomarkers"))
    parsed = _validate_biomarker_payload(json.loads(raw))
    logger.info(
        "abacus_extract_ok",
        extra={
            "text_len": len(text),
            "symptom_count": len(symptoms),
            "prompt_version": EXTRACT_PROMPT_VERSION,
            "duration_ms": int((time.perf_counter() - started) * 1000),
        },
    )
    return parsed


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def generate_protocol(biomarkers: List[Dict], symptoms: List[str]) -> List[Dict[str, Any]]:
    started = time.perf_counter()
    symptoms_str = ", ".join(symptoms) if symptoms else "none reported"
    biomarkers_str = json.dumps(biomarkers, indent=2)
    prompt = PROTOCOL_PROMPT.replace("{biomarkers}", biomarkers_str).replace("{symptoms}", symptoms_str)

    raw = _strip_code_block(await _chat_completion(prompt, task_name="generate_protocol"))
    parsed = _validate_protocol_payload(json.loads(raw))
    logger.info(
        "abacus_protocol_ok",
        extra={
            "biomarker_count": len(biomarkers),
            "symptom_count": len(symptoms),
            "prompt_version": PROTOCOL_PROMPT_VERSION,
            "duration_ms": int((time.perf_counter() - started) * 1000),
        },
    )
    return parsed
