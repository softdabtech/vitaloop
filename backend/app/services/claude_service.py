import json
import logging
import time
from pathlib import Path
from typing import List, Dict, Any

import anthropic
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings

# Async client — does not block the FastAPI event loop
_client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
EXTRACT_PROMPT = (_PROMPTS_DIR / "extract_biomarkers.txt").read_text()
PROTOCOL_PROMPT = (_PROMPTS_DIR / "generate_protocol.txt").read_text()
EXTRACT_PROMPT_VERSION = "extract_v1"
PROTOCOL_PROMPT_VERSION = "protocol_v1"

logger = logging.getLogger(__name__)

_BIOMARKER_KEYS = {"name", "value", "unit", "status"}
_PROTOCOL_KEYS = {"supplement", "dosage", "timing", "priority", "rationale", "iherb_search"}


def _strip_code_block(raw: str) -> str:
    """Remove ```json ... ``` wrapper if Claude adds one."""
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        # Drop first line (```json or ```) and last line (```)
        raw = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
    return raw.strip()


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

    message = await _client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = _strip_code_block(message.content[0].text)
    parsed = _validate_biomarker_payload(json.loads(raw))
    logger.info(
        "claude_extract_ok",
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

    message = await _client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = _strip_code_block(message.content[0].text)
    parsed = _validate_protocol_payload(json.loads(raw))
    logger.info(
        "claude_protocol_ok",
        extra={
            "biomarker_count": len(biomarkers),
            "symptom_count": len(symptoms),
            "prompt_version": PROTOCOL_PROMPT_VERSION,
            "duration_ms": int((time.perf_counter() - started) * 1000),
        },
    )
    return parsed
