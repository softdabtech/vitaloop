import base64
import json
import logging
import time
from pathlib import Path
from typing import Any, Optional

from anthropic import APIConnectionError, APITimeoutError, AsyncAnthropic

from app.config import settings

logger = logging.getLogger("uvicorn.error")


class ClaudePDFAnalyzer:
    def __init__(self, api_key: str, model: Optional[str] = None):
        self.client = AsyncAnthropic(api_key=api_key)
        self.model = model or settings.anthropic_model
        self.max_tokens = settings.claude_max_tokens
        self.timeout = settings.claude_analysis_timeout
        self.max_pdf_size_bytes = settings.claude_pdf_max_size_mb * 1024 * 1024

    async def analyze_lab_pdf(self, pdf_path: str, symptoms: Optional[list[str]] = None) -> dict[str, Any]:
        start_time = time.time()

        try:
            if not self._validate_pdf(pdf_path):
                raise ValueError("Invalid PDF format or file too large")

            pdf_data = self._read_pdf_as_base64(pdf_path)
            symptoms = symptoms or []
            symptoms_text = f"\n\nUser-reported symptoms: {', '.join(symptoms)}" if symptoms else ""

            prompt = f"""You are an expert medical lab analyst. Analyze this complete lab report thoroughly and provide structured recommendations.

ANALYSIS REQUIREMENTS:
1. Extract ALL biomarkers with values and reference ranges
2. Categorize each: OPTIMAL, BORDERLINE, DEFICIENT, or ELEVATED
3. Identify TOP PRIORITY issues (most critical first)
4. Generate evidence-based supplement protocol
5. Provide retest schedule

PROTOCOL REQUIREMENTS:
- Use specific supplement names
- Include exact dosages
- Specify timing
- Include duration in weeks
- Explain rationale for each recommendation
- Reference the biomarker value that supports each recommendation

{symptoms_text}

RESPONSE FORMAT: Return ONLY valid JSON (no markdown):
{{
  "biomarkers": [
    {{
      "name": "Vitamin D (25-OH)",
      "value": 18,
      "unit": "ng/mL",
      "ref_low": 30,
      "ref_high": 100,
      "status": "DEFICIENT",
      "category": "vitamins"
    }}
  ],
  "top_priority": [
    {{
      "biomarker_name": "Vitamin D",
      "current_value": 18,
      "optimal_level": 50,
      "urgency": "HIGH",
      "risk": "Immune dysfunction"
    }}
  ],
  "protocol": [
    {{
      "supplement": "Vitamin D3",
      "dosage": "5000 IU",
      "timing": "morning_with_food",
      "duration_weeks": 12,
      "frequency": "daily",
      "priority": "HIGH",
      "rationale": "Address deficiency"
    }}
  ],
  "retest_schedule": [
    {{
      "biomarker": "Vitamin D",
      "weeks": 8,
      "reason": "Check progress"
    }}
  ],
  "summary": {{
    "key_findings": "Primary deficiency requires intervention",
    "estimated_improvement_timeline": "4-8 weeks",
    "lifestyle_recommendations": ["Follow clinician guidance"]
  }}
}}"""

            response = await self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                timeout=self.timeout,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "document",
                                "source": {
                                    "type": "base64",
                                    "media_type": "application/pdf",
                                    "data": pdf_data,
                                },
                            },
                            {
                                "type": "text",
                                "text": prompt,
                            },
                        ],
                    }
                ],
            )

            analysis_text = self._extract_text_content(response)
            payload = self._parse_json(analysis_text)

            required_fields = ["biomarkers", "protocol", "retest_schedule"]
            if not all(field in payload for field in required_fields):
                raise ValueError("Claude response missing required fields")

            analysis_time = time.time() - start_time
            biomarkers = payload.get("biomarkers", [])
            protocol = payload.get("protocol", [])

            logger.info(
                "claude_pdf_analysis_ok biomarkers=%s protocol=%s duration_ms=%s",
                len(biomarkers),
                len(protocol),
                int(analysis_time * 1000),
            )

            return {
                "success": True,
                "biomarkers": biomarkers,
                "top_priority": payload.get("top_priority", []),
                "protocol": protocol,
                "retest_schedule": payload.get("retest_schedule", []),
                "summary": payload.get("summary", {}),
                "analysis_time": analysis_time,
                "biomarker_count": len(biomarkers),
                "analysis_method": "claude_pdf",
            }

        except APITimeoutError:
            return {
                "success": False,
                "error": "Analysis timeout - PDF may be too large or complex.",
                "error_code": "TIMEOUT",
            }
        except APIConnectionError:
            return {
                "success": False,
                "error": "Connection error - unable to reach Claude API.",
                "error_code": "CONNECTION_ERROR",
            }
        except ValueError as exc:
            return {
                "success": False,
                "error": str(exc),
                "error_code": "VALIDATION_ERROR",
            }
        except Exception as exc:
            logger.error("claude_pdf_analysis_failed error=%s", repr(exc), exc_info=True)
            return {
                "success": False,
                "error": "Unexpected error during analysis.",
                "error_code": "UNKNOWN_ERROR",
            }

    def _validate_pdf(self, pdf_path: str) -> bool:
        path = Path(pdf_path)
        if not path.exists() or path.suffix.lower() != ".pdf":
            return False
        return path.stat().st_size <= self.max_pdf_size_bytes

    def _read_pdf_as_base64(self, pdf_path: str) -> str:
        with open(pdf_path, "rb") as file:
            return base64.standard_b64encode(file.read()).decode("utf-8")

    def _extract_text_content(self, response: Any) -> str:
        chunks: list[str] = []
        for item in getattr(response, "content", []) or []:
            text = getattr(item, "text", None)
            if text:
                chunks.append(text)
        return "\n".join(chunks).strip()

    def _parse_json(self, raw_text: str) -> dict[str, Any]:
        text = raw_text.strip()
        if text.startswith("```"):
            text = text.strip("`")
            text = text.replace("json", "", 1).strip()
        return json.loads(text)
