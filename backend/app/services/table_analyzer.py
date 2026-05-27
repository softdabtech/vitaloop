import logging
import time
from typing import Any, Optional, List
import csv

import openpyxl

from app.config import settings
from app.services.claude_pdf_analyzer import OpenAIFileAnalyzer

logger = logging.getLogger("uvicorn.error")


class TableAnalyzer(OpenAIFileAnalyzer):
    """Analyze spreadsheet files (XLSX, CSV)"""

    async def analyze(self, table_path: str, symptoms: Optional[List[str]] = None) -> dict[str, Any]:
        start_time = time.time()

        try:
            # Parse table
            table_text = self._parse_table(table_path)

            if not table_text or len(table_text.strip()) < 50:
                raise ValueError("Could not extract readable data from table")

            # Prepare prompt
            symptoms = symptoms or []
            symptoms_text = f"\n\nUser-reported symptoms: {', '.join(symptoms)}" if symptoms else ""

            prompt = f"""You are an expert medical lab analyst. Analyze this lab results table.

The table contains lab test results with biomarker names, values, and reference ranges.
Extract all biomarkers and provide analysis.

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

{symptoms_text}

LAB RESULTS TABLE:
{table_text[:80000]}

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

            # Send to API
            analysis_text = await self._send_text_completion(prompt)
            payload = self._parse_json(analysis_text)

            # Validate required fields
            required_fields = ["biomarkers", "protocol"]
            if not all(field in payload for field in required_fields):
                raise ValueError("Response missing required fields")

            analysis_time = time.time() - start_time
            biomarkers = payload.get("biomarkers", [])

            logger.info(
                "openai_table_analysis_ok biomarkers=%s protocol=%s duration_ms=%s",
                len(biomarkers),
                len(payload.get("protocol", [])),
                int(analysis_time * 1000),
            )

            result = self._normalize_response(payload, "openai_table")
            result["analysis_time"] = analysis_time
            result["biomarker_count"] = len(biomarkers)
            return result

        except Exception as exc:
            logger.error("openai_table_analysis_failed error=%s", repr(exc), exc_info=True)
            return {
                "success": False,
                "error": str(exc),
                "error_code": self._get_error_code(exc),
            }

    @staticmethod
    def _parse_table(file_path: str) -> str:
        """Parse table file (XLSX, CSV) to structured text"""
        if file_path.endswith('.csv'):
            return TableAnalyzer._parse_csv(file_path)
        elif file_path.endswith(('.xlsx', '.xls')):
            return TableAnalyzer._parse_xlsx(file_path)
        else:
            raise ValueError(f"Unknown table format: {file_path}")

    @staticmethod
    def _parse_csv(csv_path: str) -> str:
        """Convert CSV to structured text"""
        rows = []
        try:
            with open(csv_path, 'r', encoding='utf-8', errors='ignore') as f:
                reader = csv.reader(f)
                for i, row in enumerate(reader):
                    if i >= settings.table_analysis_max_rows:
                        break
                    # Filter empty columns
                    row = [str(cell).strip() for cell in row]
                    if any(row):  # Skip completely empty rows
                        rows.append(" | ".join(row))
        except Exception as e:
            logger.error("Failed to parse CSV: %s", repr(e))
            raise ValueError(f"Failed to parse CSV: {e}")

        return "\n".join(rows)

    @staticmethod
    def _parse_xlsx(xlsx_path: str) -> str:
        """Convert XLSX to structured text"""
        rows = []
        try:
            wb = openpyxl.load_workbook(xlsx_path, data_only=True)
            ws = wb.active

            for i, row in enumerate(ws.iter_rows(values_only=True)):
                if i >= settings.table_analysis_max_rows:
                    break

                # Limit columns
                row = row[:settings.table_analysis_max_columns]

                # Convert to strings and filter
                row = [str(cell) if cell is not None else "" for cell in row]
                if any(row):  # Skip completely empty rows
                    rows.append(" | ".join(row))

        except Exception as e:
            logger.error("Failed to parse XLSX: %s", repr(e))
            raise ValueError(f"Failed to parse XLSX: {e}")

        return "\n".join(rows)

    @staticmethod
    def _get_error_code(exc: Exception) -> str:
        """Get error code from exception"""
        if isinstance(exc, TimeoutError):
            return "TIMEOUT"
        elif isinstance(exc, ConnectionError):
            return "CONNECTION_ERROR"
        elif isinstance(exc, ValueError):
            return "VALIDATION_ERROR"
        else:
            return "UNKNOWN_ERROR"
