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

            prompt = self._build_extraction_prompt(
                document_kind="lab results table",
                symptoms=symptoms or [],
                document_text=table_text,
                knowledge_context=await self._knowledge_context(),
            )

            # Send to API
            analysis_text = await self._send_text_completion(prompt)
            payload = self._parse_json(analysis_text)

            # Validate required fields
            required_fields = ["biomarkers"]
            if not all(field in payload for field in required_fields):
                raise ValueError("Response missing required fields")

            analysis_time = time.time() - start_time
            biomarkers = payload.get("biomarkers", [])

            logger.info(
                "openai_table_analysis_ok biomarkers=%s notes=%s duration_ms=%s",
                len(biomarkers),
                len(payload.get("extraction_notes", [])),
                int(analysis_time * 1000),
            )

            result = self._normalize_response(payload, "openai_table")
            result["analysis_time"] = analysis_time
            result["biomarker_count"] = len(biomarkers)
            result["document_text_excerpt"] = table_text[:80000]
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
