import json
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


def _strip_code_block(raw: str) -> str:
    """Remove ```json ... ``` wrapper if Claude adds one."""
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        # Drop first line (```json or ```) and last line (```)
        raw = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
    return raw.strip()


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def extract_biomarkers(text: str, symptoms: List[str]) -> List[Dict[str, Any]]:
    symptoms_str = ", ".join(symptoms) if symptoms else "none reported"
    prompt = EXTRACT_PROMPT.replace("{lab_text}", text).replace("{symptoms}", symptoms_str)

    message = await _client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = _strip_code_block(message.content[0].text)
    return json.loads(raw)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def generate_protocol(biomarkers: List[Dict], symptoms: List[str]) -> List[Dict[str, Any]]:
    symptoms_str = ", ".join(symptoms) if symptoms else "none reported"
    biomarkers_str = json.dumps(biomarkers, indent=2)
    prompt = PROTOCOL_PROMPT.replace("{biomarkers}", biomarkers_str).replace("{symptoms}", symptoms_str)

    message = await _client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = _strip_code_block(message.content[0].text)
    return json.loads(raw)
