import json
from typing import List, Dict, Any

import anthropic
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings

_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

EXTRACT_PROMPT = open("app/prompts/extract_biomarkers.txt").read()
PROTOCOL_PROMPT = open("app/prompts/generate_protocol.txt").read()


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def extract_biomarkers(text: str, symptoms: List[str]) -> List[Dict[str, Any]]:
    symptoms_str = ", ".join(symptoms) if symptoms else "none reported"
    prompt = EXTRACT_PROMPT.replace("{lab_text}", text).replace("{symptoms}", symptoms_str)

    message = _client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    # Strip markdown code block if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def generate_protocol(biomarkers: List[Dict], symptoms: List[str]) -> List[Dict[str, Any]]:
    symptoms_str = ", ".join(symptoms) if symptoms else "none reported"
    biomarkers_str = json.dumps(biomarkers, indent=2)
    prompt = PROTOCOL_PROMPT.replace("{biomarkers}", biomarkers_str).replace("{symptoms}", symptoms_str)

    message = _client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)
