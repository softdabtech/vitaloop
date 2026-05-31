import asyncio
import json
import logging
import re
import time
from contextvars import ContextVar
from pathlib import Path
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings

_client: httpx.AsyncClient | None = None

# Tracks whether the last extract/protocol call used real LLM or local fallback.
# Scoped per async-task so concurrent requests don't interfere.
_analysis_source_cv: ContextVar[str] = ContextVar("_analysis_source", default="unknown")


def get_analysis_source() -> str:
    """Return 'llm', 'fallback', or 'unknown' for the current request context."""
    return _analysis_source_cv.get()

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

_STATUS_SUFFIX = r"(?:\s+(?:Normal|Low|High|Optimal|Deficient|Elevated|Borderline|Critical|LOW|HIGH|LOW NORMAL|HIGH NORMAL|[LHN]))?"
_LETTER = r"A-Za-zА-Яа-яЁёЇїІіЄєҐґ"
_NAME_START = rf"[{_LETTER}]"
_NAME_BODY = rf"[{_LETTER}0-9()/%+\- ,._']"
_UNIT_BODY = rf"[{_LETTER}%/µμ\-]"
_UNIT_PATTERN = rf"{_UNIT_BODY}+(?:/{_UNIT_BODY}+)?"
_STAR_OPT = r"(?:\s*[\*＊])?"
_LINE_PATTERNS = [
    re.compile(
        rf"(?P<name>{_NAME_START}{_NAME_BODY}{{2,}}?)\s+"
        r"(?P<value>-?\d+(?:[.,]\d+)?)"
        + _STAR_OPT
        + r"\s*"
        rf"(?P<unit>{_UNIT_PATTERN})?\s*"
        r"(?:(?P<low>-?\d+(?:[.,]\d+)?)"
        + _STAR_OPT
        + r"\s*[-–]\s*(?P<high>-?\d+(?:[.,]\d+)?)"
        + _STAR_OPT
        + r")?"
        + _STATUS_SUFFIX + r"\s*$"
    ),
    re.compile(
        rf"(?P<name>{_NAME_START}{_NAME_BODY}{{2,}}?)\s*[:=]\s*"
        r"(?P<value>-?\d+(?:[.,]\d+)?)"
        + _STAR_OPT
        + r"\s*"
        rf"(?P<unit>{_UNIT_PATTERN})?\s*"
        r"(?:\(?(?P<low>-?\d+(?:[.,]\d+)?)"
        + _STAR_OPT
        + r"\s*[-–]\s*(?P<high>-?\d+(?:[.,]\d+)?)"
        + _STAR_OPT
        + r"\)?)?"
        + _STATUS_SUFFIX + r"\s*$"
    ),
]

_CATEGORY_KEYWORDS = {
    "vitamins": ["vitamin", "folate", "b12"],
    "minerals": ["iron", "ferritin", "magnesium", "zinc", "selenium", "calcium", "potassium", "sodium"],
    "thyroid": ["tsh", "t3", "t4", "thyroid"],
    "lipids": ["cholesterol", "hdl", "ldl", "triglycer"],
    "glucose": ["glucose", "insulin", "a1c", "hba1c"],
    "inflammation": ["crp", "esr", "homocysteine"],
    "hormones": ["testosterone", "estradiol", "cortisol", "progesterone", "dhea"],
}

_FALLBACK_PROTOCOLS = [
    {
        "keywords": ["vitamin d", "25-oh"],
        "supplement": "Vitamin D3",
        "dosage": "5000 IU",
        "timing": "morning_with_food",
        "priority": "HIGH",
        "rationale": "Low vitamin D commonly benefits from D3 repletion and repeat testing.",
        "iherb_search": "Vitamin D3 5000 IU",
    },
    {
        "keywords": ["magnesium"],
        "supplement": "Magnesium glycinate",
        "dosage": "200-400 mg",
        "timing": "evening",
        "priority": "MEDIUM",
        "rationale": "Magnesium support can help with deficiency patterns and recovery.",
        "iherb_search": "Magnesium glycinate",
    },
    {
        "keywords": ["ferritin", "iron"],
        "supplement": "Iron bisglycinate",
        "dosage": "25 mg",
        "timing": "between_meals",
        "priority": "HIGH",
        "rationale": "Low iron markers may respond to targeted iron repletion if clinically appropriate.",
        "iherb_search": "Iron bisglycinate 25 mg",
    },
    {
        "keywords": ["b12"],
        "supplement": "Vitamin B12",
        "dosage": "1000 mcg",
        "timing": "morning",
        "priority": "MEDIUM",
        "rationale": "Low B12 markers often benefit from supplemental B12 support.",
        "iherb_search": "Vitamin B12 1000 mcg",
    },
]


def is_llm_configured() -> bool:
    return bool((settings.active_llm_api_key or "").strip())


def _to_float(value: str | None) -> float | None:
    if value is None:
        return None
    raw = re.sub(r"[^0-9.,+\-]", "", str(value)).strip().replace(",", ".")
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", str(name or "").strip(" :-")).strip()


def _infer_category(name: str) -> str | None:
    lowered = name.lower()
    for category, keywords in _CATEGORY_KEYWORDS.items():
        if any(keyword in lowered for keyword in keywords):
            return category
    return None


def _status_for_value(value: float, low: float | None, high: float | None) -> str:
    if low is not None and value < low:
        return "DEFICIENT"
    if high is not None and value > high:
        return "ELEVATED"
    if low is not None and high is not None:
        band = high - low
        if band > 0:
            lower_warn = low + band * 0.15
            upper_warn = high - band * 0.15
            if value <= lower_warn or value >= upper_warn:
                return "BORDERLINE"
    return "OPTIMAL"


def _normalize_status(status: str | None, value: float | None, low: float | None, high: float | None) -> str:
    raw = str(status or "").strip().upper()
    mapped = {
        "OPTIMAL": "OPTIMAL",
        "NORMAL": "OPTIMAL",
        "N": "OPTIMAL",
        "BORDERLINE": "BORDERLINE",
        "LOW NORMAL": "BORDERLINE",
        "HIGH NORMAL": "BORDERLINE",
        "LOW": "DEFICIENT",
        "L": "DEFICIENT",
        "DEFICIENT": "DEFICIENT",
        "HIGH": "ELEVATED",
        "H": "ELEVATED",
        "ELEVATED": "ELEVATED",
        "CRITICAL": "ELEVATED",
    }
    canonical = mapped.get(raw)
    if canonical:
        return canonical
    if value is not None:
        return _status_for_value(value, low, high)
    return "OPTIMAL"


def _coalesce_multiline_rows(text: str) -> List[str]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    merged: List[str] = []
    i = 0
    while i < len(lines):
        current = lines[i]
        nxt = lines[i + 1] if i + 1 < len(lines) else ""

        current_has_number = bool(re.search(r"\d", current))
        next_has_number = bool(re.search(r"\d", nxt))

        # Some reports split biomarker names into two lines before the numeric payload.
        if (not current_has_number) and next_has_number:
            merged.append(f"{current} {nxt}".strip())
            i += 2
            continue

        merged.append(current)
        i += 1

    return merged


def _normalize_biomarker_item(item: Dict[str, Any]) -> Dict[str, Any] | None:
    name = _normalize_name(str(item.get("name") or ""))
    value = _to_float(str(item.get("value")) if item.get("value") is not None else None)
    low = _to_float(str(item.get("ref_low")) if item.get("ref_low") is not None else None)
    high = _to_float(str(item.get("ref_high")) if item.get("ref_high") is not None else None)
    unit = str(item.get("unit") or "").strip() or "unit"

    if not name or value is None:
        return None

    return {
        **item,
        "name": name,
        "value": value,
        "unit": unit,
        "ref_low": low,
        "ref_high": high,
        "status": _normalize_status(item.get("status"), value, low, high),
        "category": item.get("category") or _infer_category(name),
    }


def _fallback_extract_biomarkers(text: str) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    seen: set[tuple[str, float]] = set()

    for line in _coalesce_multiline_rows(text):
        if len(line) < 6:
            continue
        for pattern in _LINE_PATTERNS:
            match = pattern.match(line)
            if not match:
                continue

            name = _normalize_name(match.group("name"))
            value = _to_float(match.group("value"))
            unit = (match.group("unit") or "").strip() or "unit"
            low = _to_float(match.group("low"))
            high = _to_float(match.group("high"))

            if not name or value is None:
                continue
            if len(name) < 3 or name.lower() in {"range", "reference", "result", "value"}:
                continue

            fingerprint = (name.lower(), value)
            if fingerprint in seen:
                continue
            seen.add(fingerprint)

            rows.append(
                {
                    "name": name,
                    "value": value,
                    "unit": unit,
                    "ref_low": low,
                    "ref_high": high,
                    "status": _normalize_status(None, value, low, high),
                    "category": _infer_category(name),
                }
            )
            break

    return rows


def _fallback_generate_protocol(biomarkers: List[Dict[str, Any]], symptoms: List[str]) -> List[Dict[str, Any]]:
    recommendations: List[Dict[str, Any]] = []
    seen_supplements: set[str] = set()

    for biomarker in biomarkers:
        name = str(biomarker.get("name") or "").lower()
        status = str(biomarker.get("status") or "").upper()
        if status not in {"DEFICIENT", "ELEVATED", "BORDERLINE"}:
            continue

        for template in _FALLBACK_PROTOCOLS:
            if any(keyword in name for keyword in template["keywords"]):
                supplement = template["supplement"]
                if supplement in seen_supplements:
                    break
                seen_supplements.add(supplement)
                recommendations.append(dict(template))
                break

    if not recommendations:
        symptom_hint = ", ".join(symptoms[:2]) if symptoms else "reported symptoms"
        recommendations.append(
            {
                "supplement": "Comprehensive re-test plan",
                "dosage": "Repeat labs in 6-8 weeks",
                "timing": "follow_up",
                "priority": "MEDIUM",
                "rationale": f"Fallback mode detected no specific supplement target. Use symptoms ({symptom_hint}) and repeat labs to refine the protocol.",
                "iherb_search": "electrolyte support",
            }
        )

    return recommendations


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        base_url = settings.active_llm_base_url.rstrip("/")
        api_key = settings.active_llm_api_key
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured.")
        _client = httpx.AsyncClient(
            base_url=base_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=90.0,
        )
    return _client


def _chat_completions_path() -> str:
    """Return chat completions path relative to the configured provider base URL."""
    base_url = str(settings.active_llm_base_url or "").strip()
    host = (urlparse(base_url).hostname or "").lower()

    # DigitalOcean Agent Inference uses /api/v1/chat/completions.
    if host.endswith("agents.do-ai.run"):
        return "api/v1/chat/completions"

    return "chat/completions"


def _chat_payload(messages: List[Dict[str, Any]], temperature: float) -> Dict[str, Any]:
    return {
        "temperature": temperature,
        "messages": messages,
        "model": settings.active_llm_model,
    }


def _strip_code_block(raw: str) -> str:
    """Remove ```json ... ``` wrapper if Claude adds one."""
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        # Drop first line (```json or ```) and last line (```)
        raw = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
    return raw.strip()


async def _persist_usage_event(
    *,
    task_name: str,
    payload: Dict[str, Any],
    user_id: str | None,
    upload_id: str | None,
) -> None:
    try:
        usage = payload.get("usage") or {}
        prompt_tokens = int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
        completion_tokens = int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
        total_tokens = int(usage.get("total_tokens") or (prompt_tokens + completion_tokens))
        if prompt_tokens <= 0 and completion_tokens <= 0 and total_tokens <= 0:
            return

        provider = "openai"
        model = str(payload.get("model") or settings.active_llm_model or "unknown")

        from app.services import supabase_service as svc

        sb = svc._get_supabase()
        row = {
            "task_name": task_name,
            "provider": provider,
            "model": model,
            "user_id": user_id,
            "upload_id": upload_id,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "meta": {
                "response_id": payload.get("id"),
            },
        }
        await svc._run(lambda: sb.table("llm_usage_events").insert(row).execute())
    except Exception as ex:
        logger.warning("llm_usage_event_failed task=%s reason=%s", task_name, ex)


async def _chat_completion(
    prompt: str,
    *,
    task_name: str,
    user_id: str | None = None,
    upload_id: str | None = None,
) -> str:
    client = _get_client()
    model = settings.active_llm_model
    base_url = settings.active_llm_base_url.rstrip("/")
    key_suffix = settings.active_llm_api_key[-4:] if settings.active_llm_api_key else "none"
    started = time.perf_counter()
    logger.info(
        "llm_request_start task=%s base_url=%s model=%s key_suffix=%s",
        task_name,
        base_url,
        model,
        key_suffix,
    )
    response = await client.post(
        _chat_completions_path(),
        json=_chat_payload(
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0,
        ),
    )
    response.raise_for_status()
    payload = response.json()
    await _persist_usage_event(
        task_name=task_name,
        payload=payload,
        user_id=user_id,
        upload_id=upload_id,
    )
    response_id = payload.get("id")
    choices = payload.get("choices") or []
    if not choices:
        raise ValueError("LLM API returned no choices")
    content = ((choices[0] or {}).get("message") or {}).get("content")
    if not isinstance(content, str) or not content.strip():
        raise ValueError("LLM API returned empty content")
    logger.info(
        "llm_request_ok task=%s model=%s response_id=%s duration_ms=%s",
        task_name,
        model,
        response_id,
        int((time.perf_counter() - started) * 1000),
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
async def extract_biomarkers(
    text: str,
    symptoms: List[str],
    *,
    user_id: str | None = None,
    upload_id: str | None = None,
) -> List[Dict[str, Any]]:
    if not is_llm_configured():
        logger.error(
            "llm_fallback_used task=extract_biomarkers reason=llm_not_configured "
            "user_id=%s upload_id=%s hint='Analysis used local regex, NOT Claude'",
            user_id,
            upload_id,
        )
        _analysis_source_cv.set("fallback")
        return _fallback_extract_biomarkers(text)

    started = time.perf_counter()
    symptoms_str = ", ".join(symptoms) if symptoms else "none reported"
    prompt = EXTRACT_PROMPT.replace("{lab_text}", text).replace("{symptoms}", symptoms_str)
    try:
        raw = _strip_code_block(
            await _chat_completion(
                prompt,
                task_name="extract_biomarkers",
                user_id=user_id,
                upload_id=upload_id,
            )
        )
        parsed = _validate_biomarker_payload(json.loads(raw))
        parsed = [normalized for normalized in (_normalize_biomarker_item(item) for item in parsed) if normalized]
        if not parsed:
            logger.error(
                "llm_fallback_used task=extract_biomarkers reason=empty_payload "
                "user_id=%s upload_id=%s hint='LLM returned empty list, switched to regex'",
                user_id,
                upload_id,
            )
            _analysis_source_cv.set("fallback")
            return _fallback_extract_biomarkers(text)

        # Hybrid: supplement LLM results with regex extraction for any biomarkers the LLM missed.
        regex_results = _fallback_extract_biomarkers(text)
        if regex_results:
            llm_names = {b["name"].lower() for b in parsed}
            extras = [b for b in regex_results if b["name"].lower() not in llm_names]
            if extras:
                logger.info("abacus_extract_hybrid llm=%s regex_added=%s", len(parsed), len(extras))
                parsed = parsed + extras

        logger.info(
            "abacus_extract_ok text_len=%s symptom_count=%s prompt_version=%s duration_ms=%s total=%s",
            len(text),
            len(symptoms),
            EXTRACT_PROMPT_VERSION,
            int((time.perf_counter() - started) * 1000),
            len(parsed),
        )
        _analysis_source_cv.set("llm")
        return parsed
    except Exception as ex:
        logger.error(
            "llm_fallback_used task=extract_biomarkers reason=%s "
            "user_id=%s upload_id=%s hint='LLM call failed, switched to regex'",
            ex,
            user_id,
            upload_id,
        )
        _analysis_source_cv.set("fallback")
        return _fallback_extract_biomarkers(text)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def generate_protocol(
    biomarkers: List[Dict],
    symptoms: List[str],
    *,
    user_id: str | None = None,
    upload_id: str | None = None,
) -> List[Dict[str, Any]]:
    if not is_llm_configured():
        logger.error(
            "llm_fallback_used task=generate_protocol reason=llm_not_configured "
            "user_id=%s upload_id=%s hint='Protocol used local templates, NOT Claude'",
            user_id,
            upload_id,
        )
        _analysis_source_cv.set("fallback")
        return _fallback_generate_protocol(biomarkers, symptoms)

    started = time.perf_counter()
    symptoms_str = ", ".join(symptoms) if symptoms else "none reported"
    biomarkers_str = json.dumps(biomarkers, indent=2)
    prompt = PROTOCOL_PROMPT.replace("{biomarkers}", biomarkers_str).replace("{symptoms}", symptoms_str)
    try:
        raw = _strip_code_block(
            await _chat_completion(
                prompt,
                task_name="generate_protocol",
                user_id=user_id,
                upload_id=upload_id,
            )
        )
        parsed = _validate_protocol_payload(json.loads(raw))
        if not parsed:
            logger.error(
                "llm_fallback_used task=generate_protocol reason=empty_payload "
                "user_id=%s upload_id=%s hint='LLM returned empty list, switched to templates'",
                user_id,
                upload_id,
            )
            _analysis_source_cv.set("fallback")
            return _fallback_generate_protocol(biomarkers, symptoms)
        logger.info(
            "abacus_protocol_ok biomarker_count=%s symptom_count=%s prompt_version=%s duration_ms=%s",
            len(biomarkers),
            len(symptoms),
            PROTOCOL_PROMPT_VERSION,
            int((time.perf_counter() - started) * 1000),
        )
        _analysis_source_cv.set("llm")
        return parsed
    except Exception as ex:
        logger.error(
            "llm_fallback_used task=generate_protocol reason=%s "
            "user_id=%s upload_id=%s hint='LLM call failed, switched to templates'",
            ex,
            user_id,
            upload_id,
        )
        _analysis_source_cv.set("fallback")
        return _fallback_generate_protocol(biomarkers, symptoms)


# ---------------------------------------------------------------------------
# Questionnaire Engine v2 — LLM-driven follow-up + summary
# ---------------------------------------------------------------------------

_QUESTIONNAIRE_FOLLOWUP_SYSTEM = (
    "You are a health assessment assistant. Return only valid JSON. "
    "Do not include markdown, code fences, or commentary."
)

_QUESTIONNAIRE_FOLLOWUP_TMPL = """A user answered a health questionnaire question with a very low score indicating a concern.

Question: "{question_text}"
Dimension: {dimension}
User score: {answer_value}/10
User comment: {answer_text}

Generate ONE concise follow-up question (under 20 words) that helps understand the root cause.
Return JSON: {{"text": "Follow-up question here?"}}"""

_QUESTIONNAIRE_SUMMARY_TMPL = """A user completed an adaptive health questionnaire.

Questions and scores (1–10, higher = better):
{answers_text}

Dimension scores (0–100):
{dimension_text}

Overall health score: {completion_score}/100

Write a warm, personalized 3-sentence summary:
1. Acknowledge their 1–2 strongest areas.
2. Identify their most concerning area and what it might mean.
3. One encouraging and specific next step they can take today.

Return JSON: {{"summary": "Your summary text here."}}"""


async def generate_questionnaire_followup(
    question_text: str,
    dimension: str,
    answer_value: int,
    answer_text: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Generate a contextual follow-up question for a low-score answer.

    Returns a dict with `text` and `dimension`, or None if LLM unavailable/fails.
    """
    if not is_llm_configured():
        return None
    prompt = _QUESTIONNAIRE_FOLLOWUP_TMPL.format(
        question_text=question_text,
        dimension=dimension,
        answer_value=answer_value,
        answer_text=answer_text or "(none)",
    )
    client = _get_client()
    try:
        raw = await asyncio.wait_for(
            client.post(
                _chat_completions_path(),
                json=_chat_payload(
                    messages=[
                        {"role": "system", "content": _QUESTIONNAIRE_FOLLOWUP_SYSTEM},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.3,
                ),
            ),
            timeout=8.0,
        )
        raw.raise_for_status()
        payload = raw.json()
        await _persist_usage_event(
            task_name="questionnaire_followup",
            payload=payload,
            user_id=None,
            upload_id=None,
        )
        choices = payload.get("choices") or []
        content = ((choices[0] or {}).get("message") or {}).get("content", "")
        parsed = json.loads(_strip_code_block(content))
        text = (parsed.get("text") or "").strip()
        if not text:
            return None
        return {"text": text, "dimension": dimension}
    except Exception as ex:
        logger.warning("questionnaire_followup_failed reason=%s", ex)
        return None


async def generate_questionnaire_summary(
    answers_text: str,
    dimension_scores: Dict[str, float],
    completion_score: float,
) -> Optional[str]:
    """Generate a personalized health summary from completed questionnaire.

    Returns summary string or None if LLM unavailable/fails.
    """
    if not is_llm_configured():
        return None
    dim_text = "\n".join(f"- {k}: {v:.0f}/100" for k, v in sorted(dimension_scores.items()))
    prompt = _QUESTIONNAIRE_SUMMARY_TMPL.format(
        answers_text=answers_text,
        dimension_text=dim_text,
        completion_score=f"{completion_score:.0f}",
    )
    client = _get_client()
    try:
        raw = await asyncio.wait_for(
            client.post(
                _chat_completions_path(),
                json=_chat_payload(
                    messages=[
                        {"role": "system", "content": _QUESTIONNAIRE_FOLLOWUP_SYSTEM},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.4,
                ),
            ),
            timeout=18.0,
        )
        raw.raise_for_status()
        payload = raw.json()
        await _persist_usage_event(
            task_name="questionnaire_summary",
            payload=payload,
            user_id=None,
            upload_id=None,
        )
        choices = payload.get("choices") or []
        content = ((choices[0] or {}).get("message") or {}).get("content", "")
        parsed = json.loads(_strip_code_block(content))
        summary = (parsed.get("summary") or "").strip()
        return summary or None
    except Exception as ex:
        logger.warning("questionnaire_summary_failed reason=%s", ex)
        return None
