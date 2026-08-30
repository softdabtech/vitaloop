import asyncio
import base64
import json
import logging
import time
import tempfile
import mimetypes
from io import BytesIO
from pathlib import Path
from typing import Any, Optional, List
from abc import ABC, abstractmethod

import httpx
from pypdf import PdfReader
from PIL import Image
from pdf2image import convert_from_path

try:
    from markitdown import MarkItDown
except ImportError:  # pragma: no cover - production dependency, fallback remains available
    MarkItDown = None

from app.config import settings
from app.services.knowledge.integration import build_biomarker_extraction_knowledge_context

logger = logging.getLogger("uvicorn.error")

_EXTRACTION_STATUS_VALUES = "OPTIMAL, BORDERLINE, DEFICIENT, ELEVATED"
_EXTRACTION_CATEGORIES = (
    "blood_count, metabolic, lipids, liver, kidney, thyroid, vitamins, minerals, "
    "hormones, inflammation, electrolytes, urinalysis, coagulation, other"
)


class OpenAIFileAnalyzer(ABC):
    """Base class for file analysis using OpenAI APIs"""

    def __init__(self, api_key: str, model: Optional[str] = None):
        self.api_key = api_key
        self.base_url = (settings.active_llm_base_url or "https://api.openai.com/v1").rstrip("/")
        self.text_model = model or settings.active_llm_model
        self.vision_model = settings.openai_vision_model
        self.max_tokens = settings.claude_max_tokens
        self.timeout = settings.claude_analysis_timeout
        self.max_pdf_size_bytes = settings.claude_pdf_max_size_mb * 1024 * 1024
        self.max_image_size_bytes = settings.image_max_size_mb * 1024 * 1024
        self.tiff_max_pages = settings.tiff_max_pages
        self.table_max_rows = settings.table_analysis_max_rows

    @abstractmethod
    async def analyze(self, file_path: str, symptoms: Optional[List[str]] = None) -> dict[str, Any]:
        """Analyze file and return biomarkers and protocol"""
        pass

    @staticmethod
    def _detect_file_type(file_path: str) -> str:
        """Detect file type by extension and magic bytes"""
        path = Path(file_path)
        ext = path.suffix.lower()

        # Mapping of extensions to types
        type_mapping = {
            '.pdf': 'pdf',
            '.png': 'image',
            '.jpg': 'image',
            '.jpeg': 'image',
            '.gif': 'image',
            '.bmp': 'image',
            '.webp': 'image',
            '.tiff': 'tiff',
            '.tif': 'tiff',
            '.xlsx': 'table',
            '.xls': 'table',
            '.csv': 'table',
            '.txt': 'text',
        }

        return type_mapping.get(ext, 'unknown')

    @staticmethod
    def _extract_pdf_text_with_pypdf(pdf_path: str, max_length: int = 80000) -> str:
        """Extract plain text from a PDF using the lightweight fallback parser."""
        try:
            reader = PdfReader(pdf_path)
            chunks: list[str] = []
            for page in reader.pages:
                text = page.extract_text() or ""
                if text.strip():
                    chunks.append(text)
            result = "\n".join(chunks).strip()
            return result[:max_length]
        except Exception as e:
            logger.warning(f"Failed to extract PDF text: {e}")
            return ""

    @classmethod
    def _extract_pdf_content(cls, pdf_path: str, max_length: int = 80000) -> tuple[str, str]:
        """Convert a local PDF to LLM-friendly Markdown with a pypdf fallback."""
        if MarkItDown is not None:
            try:
                result = MarkItDown(enable_plugins=False).convert_local(pdf_path)
                markdown = (result.text_content or "").strip()
                if markdown:
                    logger.info(
                        "markitdown_pdf_conversion_ok chars=%s path=%s",
                        len(markdown),
                        Path(pdf_path).name,
                    )
                    return markdown[:max_length], "markitdown"
            except Exception as exc:
                logger.warning(
                    "markitdown_pdf_conversion_failed error=%s path=%s",
                    repr(exc),
                    Path(pdf_path).name,
                )

        fallback_text = cls._extract_pdf_text_with_pypdf(pdf_path, max_length=max_length)
        return fallback_text, "pypdf"

    @classmethod
    def _extract_pdf_text(cls, pdf_path: str, max_length: int = 80000) -> str:
        """Backward-compatible PDF extraction helper."""
        text, _parser = cls._extract_pdf_content(pdf_path, max_length=max_length)
        return text

    async def _send_text_completion(self, prompt: str, model: Optional[str] = None) -> str:
        """Send text prompt to OpenAI API and get completion"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": model or self.text_model,
            "messages": [
                {"role": "system", "content": "You are a precise clinical lab report analyzer. Return ONLY valid JSON."},
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0,
            "max_tokens": min(self.max_tokens, 4096),
        }

        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout) as client:
                resp = await client.post("chat/completions", json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
        except httpx.TimeoutException:
            raise TimeoutError("OpenAI request took too long")
        except httpx.ConnectError:
            raise ConnectionError("Unable to reach OpenAI API")
        except httpx.HTTPStatusError as e:
            logger.error(f"OpenAI API error: {e.response.status_code} {e.response.text}")
            raise

        choices = data.get("choices") or []
        if not choices:
            raise ValueError("OpenAI API returned no choices")

        content = ((choices[0] or {}).get("message") or {}).get("content")
        if not isinstance(content, str) or not content.strip():
            raise ValueError("OpenAI API returned empty content")

        return content

    async def _send_vision_completion(self, image_base64: str, prompt: str) -> str:
        """Send image with text prompt to OpenAI Vision API"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.vision_model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}"
                            },
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }
            ],
            "temperature": 0,
            "max_tokens": min(self.max_tokens, 4096),
        }

        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout) as client:
                resp = await client.post("chat/completions", json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
        except httpx.TimeoutException:
            raise TimeoutError("OpenAI Vision request took too long")
        except httpx.ConnectError:
            raise ConnectionError("Unable to reach OpenAI API")
        except httpx.HTTPStatusError as e:
            logger.error(f"OpenAI Vision API error: {e.response.status_code} {e.response.text}")
            raise

        choices = data.get("choices") or []
        if not choices:
            raise ValueError("OpenAI API returned no choices")

        content = ((choices[0] or {}).get("message") or {}).get("content")
        if not isinstance(content, str) or not content.strip():
            raise ValueError("OpenAI API returned empty content")

        return content

    @staticmethod
    def _parse_json(raw_text: str) -> dict[str, Any]:
        """Parse JSON response, handling markdown wrapping"""
        text = raw_text.strip()
        if text.startswith("```"):
            text = text.strip("`")
            text = text.replace("json", "", 1).strip()
        return json.loads(text)

    @staticmethod
    def _normalize_response(result: dict, analysis_method: str) -> dict:
        """Normalize response to standard format"""
        return {
            "success": True,
            "biomarkers": result.get("biomarkers", []),
            "top_priority": [],
            "protocol": [],
            "retest_schedule": [],
            "summary": result.get("summary", {}),
            "document_metadata": result.get("document_metadata", {}),
            "extraction_notes": result.get("extraction_notes", []),
            "analysis_method": analysis_method,
        }

    @staticmethod
    async def _knowledge_context() -> str:
        return await build_biomarker_extraction_knowledge_context()

    @staticmethod
    def _build_extraction_prompt(
        *,
        document_kind: str,
        symptoms: Optional[List[str]] = None,
        document_text: Optional[str] = None,
        page_num: Optional[int] = None,
        knowledge_context: str = "",
    ) -> str:
        symptoms_text = ", ".join(symptoms or []) if symptoms else "none reported"
        page_text = f" Page: {page_num}." if page_num else ""
        lab_text = f"\n\nDOCUMENT TEXT:\n{document_text[:80000]}" if document_text else ""
        kb_text = knowledge_context or ""

        return f"""You are VITALOOP's clinical lab data extraction engine.{page_text}

Goal:
Extract structured lab data from the uploaded {document_kind}. This is extraction only.
Do not diagnose. Do not generate supplement plans, protocols, medical advice, or treatment recommendations.

Use VITALOOP Knowledge Base marker names/keys when available.
If a visible marker is not in the knowledge context, still extract it accurately and set marker_key to null.

User-reported symptoms: {symptoms_text}

Extraction rules:
1. Extract every visible lab marker/analyte with a numeric result.
2. Preserve the original printed marker label in source_name.
3. Normalize name to the closest clear display name.
4. Set marker_key only when the marker confidently matches a known VITALOOP lab marker key.
5. Extract value as a number only. Put units in unit.
6. Extract ref_low/ref_high when a numeric reference range is visible. If only text is visible, keep it in reference_range.
7. Status must be one of: {_EXTRACTION_STATUS_VALUES}.
8. If status is not printed, infer from value and reference range only; otherwise use OPTIMAL.
9. Category must be one of: {_EXTRACTION_CATEGORIES}.
10. Include document metadata when visible: lab_name, report_date, patient_name, specimen_date, collection_date. Do NOT also duplicate these (or other administrative fields such as Patient ID, Specimen ID, Accession Number, Page Number, Phone, Address, Provider, Doctor) as entries in the biomarkers array — they are not lab analyte results.
11. Include extraction_notes for uncertainty, missing units, unreadable rows, duplicate pages, or non-lab content.

Return ONLY valid JSON. No markdown. No commentary.

JSON schema:
{{
  "document_metadata": {{
    "lab_name": null,
    "report_date": null,
    "patient_name": null,
    "specimen_date": null,
    "collection_date": null
  }},
  "biomarkers": [
    {{
      "marker_key": "vitamin_d",
      "source_name": "25-OH Vitamin D",
      "name": "Vitamin D",
      "value": 24.0,
      "unit": "ng/mL",
      "ref_low": 30.0,
      "ref_high": 100.0,
      "reference_range": "30-100 ng/mL",
      "status": "DEFICIENT",
      "category": "vitamins",
      "confidence": 0.92,
      "notes": null
    }}
  ],
  "summary": {{
    "document_type": "lab_report",
    "extracted_marker_count": 1
  }},
  "extraction_notes": []
}}
{kb_text}{lab_text}"""


class PDFTextAnalyzer(OpenAIFileAnalyzer):
    """Analyze text-based PDF files"""

    @staticmethod
    def _chunk_document_text(document_text: str, max_chars: int = 6000) -> list[str]:
        lines = document_text.splitlines()
        chunks: list[str] = []
        current: list[str] = []
        current_length = 0
        for line in lines:
            line_length = len(line) + 1
            if current and current_length + line_length > max_chars:
                chunks.append("\n".join(current).strip())
                current = []
                current_length = 0
            current.append(line)
            current_length += line_length
        if current:
            chunks.append("\n".join(current).strip())
        return [chunk for chunk in chunks if chunk]

    @staticmethod
    def _merge_extraction_payloads(payloads: list[dict[str, Any]]) -> dict[str, Any]:
        biomarkers: list[dict[str, Any]] = []
        seen: set[tuple[str, str, str]] = set()
        extraction_notes: list[Any] = []
        document_metadata: dict[str, Any] = {}

        for payload in payloads:
            if not document_metadata and isinstance(payload.get("document_metadata"), dict):
                document_metadata = payload.get("document_metadata") or {}
            if isinstance(payload.get("extraction_notes"), list):
                extraction_notes.extend(payload.get("extraction_notes") or [])
            for item in payload.get("biomarkers") or []:
                if not isinstance(item, dict):
                    continue
                marker_name = str(
                    item.get("marker_key")
                    or item.get("source_name")
                    or item.get("name")
                    or ""
                ).strip().lower()
                value = str(item.get("value") or "").strip()
                unit = str(item.get("unit") or "").strip().lower()
                dedupe_key = (marker_name, value, unit)
                if not marker_name or dedupe_key in seen:
                    continue
                seen.add(dedupe_key)
                biomarkers.append(item)

        return {
            "biomarkers": biomarkers,
            "summary": {
                "document_type": "lab_report",
                "extracted_marker_count": len(biomarkers),
                "text_chunks_analyzed": len(payloads),
            },
            "document_metadata": document_metadata,
            "extraction_notes": extraction_notes,
        }

    async def analyze(self, pdf_path: str, symptoms: Optional[List[str]] = None) -> dict[str, Any]:
        start_time = time.time()

        try:
            # Validate and extract
            if not self._validate_pdf(pdf_path):
                raise ValueError("Invalid PDF format or file too large")

            extracted_text, document_parser = await asyncio.to_thread(
                self._extract_pdf_content,
                pdf_path,
            )
            if len(extracted_text.strip()) < 50:
                raise ValueError("Could not extract readable text from PDF")

            chunks = self._chunk_document_text(extracted_text)
            knowledge_context = await self._knowledge_context()
            payloads: list[dict[str, Any]] = []
            for chunk_index, chunk in enumerate(chunks, 1):
                prompt = self._build_extraction_prompt(
                    document_kind=(
                        "Markdown-converted lab PDF"
                        if document_parser == "markitdown"
                        else "text-based lab PDF"
                    ),
                    symptoms=symptoms or [],
                    document_text=chunk,
                    page_num=chunk_index if len(chunks) > 1 else None,
                    knowledge_context=knowledge_context,
                )

                analysis_text = await self._send_text_completion(prompt)
                logger.debug(f"OpenAI response (first 500 chars): {analysis_text[:500]}")

                try:
                    payloads.append(self._parse_json(analysis_text))
                except json.JSONDecodeError as e:
                    logger.error(f"JSON parsing failed: {e}, response: {analysis_text[:1000]}")
                    raise ValueError(f"API returned invalid JSON: {str(e)}")

            payload = self._merge_extraction_payloads(payloads)

            # Validate required fields
            required_fields = ["biomarkers"]
            if not all(field in payload for field in required_fields):
                logger.error(f"Missing fields in response. Got: {list(payload.keys())}")
                raise ValueError("Response missing required fields")

            analysis_time = time.time() - start_time
            biomarkers = payload.get("biomarkers", [])

            logger.info(
                "openai_pdf_text_analysis_ok biomarkers=%s notes=%s duration_ms=%s",
                len(biomarkers),
                len(payload.get("extraction_notes", [])),
                int(analysis_time * 1000),
            )

            analysis_method = (
                "openai_pdf_text_markitdown"
                if document_parser == "markitdown"
                else "openai_pdf_text"
            )
            result = self._normalize_response(payload, analysis_method)
            result["analysis_time"] = analysis_time
            result["biomarker_count"] = len(biomarkers)
            result["document_parser"] = document_parser
            result["document_input_chars"] = len(extracted_text)
            result["document_chunks"] = len(chunks)
            result["document_text_excerpt"] = extracted_text[:80000]
            return result

        except Exception as exc:
            logger.error("openai_pdf_text_analysis_failed error=%s", repr(exc), exc_info=True)
            return {
                "success": False,
                "error": str(exc),
                "error_code": self._get_error_code(exc),
            }

    @staticmethod
    def _validate_pdf(pdf_path: str) -> bool:
        """Validate PDF file"""
        path = Path(pdf_path)
        if not path.exists() or path.suffix.lower() != ".pdf":
            return False
        return path.stat().st_size <= 10 * 1024 * 1024  # 10MB

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


class ImageAnalyzer(OpenAIFileAnalyzer):
    """Analyze image files (PNG, JPG, GIF, BMP, WEBP) using Vision API"""

    async def analyze(self, image_path: str, symptoms: Optional[List[str]] = None) -> dict[str, Any]:
        start_time = time.time()

        try:
            if not settings.enable_vision_api:
                raise ValueError("Vision API is disabled")

            # Validate image
            if not self._validate_image(image_path):
                raise ValueError("Invalid image format or file too large")

            # Encode image
            image_base64 = self._encode_image_as_base64(image_path)

            prompt = self._build_extraction_prompt(
                document_kind="lab report image",
                symptoms=symptoms or [],
                knowledge_context=await self._knowledge_context(),
            )

            # Send to Vision API
            analysis_text = await self._send_vision_completion(image_base64, prompt)
            payload = self._parse_json(analysis_text)

            # Validate
            required_fields = ["biomarkers"]
            if not all(field in payload for field in required_fields):
                raise ValueError("Response missing required fields")

            analysis_time = time.time() - start_time
            biomarkers = payload.get("biomarkers", [])

            logger.info(
                "openai_vision_analysis_ok biomarkers=%s notes=%s duration_ms=%s",
                len(biomarkers),
                len(payload.get("extraction_notes", [])),
                int(analysis_time * 1000),
            )

            result = self._normalize_response(payload, "openai_vision")
            result["analysis_time"] = analysis_time
            result["biomarker_count"] = len(biomarkers)
            return result

        except Exception as exc:
            logger.error("openai_vision_analysis_failed error=%s", repr(exc), exc_info=True)
            return {
                "success": False,
                "error": str(exc),
                "error_code": self._get_error_code(exc),
            }

    @staticmethod
    def _validate_image(image_path: str) -> bool:
        """Validate image file"""
        path = Path(image_path)
        if not path.exists():
            return False

        ext = path.suffix.lower()
        valid_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'}
        if ext not in valid_extensions:
            return False

        # Check file size
        return path.stat().st_size <= settings.image_max_size_mb * 1024 * 1024

    @staticmethod
    def _encode_image_as_base64(image_path: str) -> str:
        """Encode image as base64"""
        with open(image_path, "rb") as image_file:
            return base64.standard_b64encode(image_file.read()).decode("utf-8")

    @staticmethod
    def _get_error_code(exc: Exception) -> str:
        """Get error code from exception"""
        if isinstance(exc, TimeoutError):
            return "TIMEOUT"
        elif isinstance(exc, ConnectionError):
            return "CONNECTION_ERROR"
        elif isinstance(exc, ValueError):
            if "disabled" in str(exc).lower():
                return "VISION_API_DISABLED"
            return "VALIDATION_ERROR"
        else:
            return "UNKNOWN_ERROR"


class PDFVisionAnalyzer(ImageAnalyzer):
    """Analyze scanned PDF files by converting pages to images"""

    async def analyze(self, pdf_path: str, symptoms: Optional[List[str]] = None) -> dict[str, Any]:
        start_time = time.time()

        try:
            if not settings.enable_vision_api:
                raise ValueError("Vision API is disabled")

            # Validate PDF
            path = Path(pdf_path)
            if not path.exists() or path.suffix.lower() != ".pdf":
                raise ValueError("Invalid PDF file")

            # Convert to images
            logger.info("Converting scanned PDF to images: %s", pdf_path)
            images = await self._convert_pdf_to_images(pdf_path)

            if not images:
                raise ValueError("Could not convert PDF pages to images")

            # Analyze first page (or combine results from multiple pages)
            all_biomarkers = []
            extraction_notes = []
            document_metadata: dict[str, Any] = {}
            knowledge_context = await self._knowledge_context()

            for page_num, image_base64 in enumerate(images, 1):
                logger.info("Analyzing page %d of %d", page_num, len(images))

                prompt = self._build_extraction_prompt(
                    document_kind="scanned lab PDF page",
                    symptoms=symptoms or [],
                    page_num=page_num,
                    knowledge_context=knowledge_context,
                )

                analysis_text = await self._send_vision_completion(image_base64, prompt)
                payload = self._parse_json(analysis_text)

                all_biomarkers.extend(payload.get("biomarkers", []))
                if isinstance(payload.get("extraction_notes"), list):
                    extraction_notes.extend(payload.get("extraction_notes", []))
                if not document_metadata and isinstance(payload.get("document_metadata"), dict):
                    document_metadata = payload.get("document_metadata") or {}

            # Merge results
            merged_payload = {
                "biomarkers": all_biomarkers,
                "summary": {"document_type": "lab_report", "extracted_marker_count": len(all_biomarkers), "pages_analyzed": len(images)},
                "document_metadata": document_metadata,
                "extraction_notes": extraction_notes,
            }

            analysis_time = time.time() - start_time

            logger.info(
                "openai_pdf_vision_analysis_ok pages=%s biomarkers=%s duration_ms=%s",
                len(images),
                len(all_biomarkers),
                int(analysis_time * 1000),
            )

            result = self._normalize_response(merged_payload, "openai_pdf_vision")
            result["analysis_time"] = analysis_time
            result["biomarker_count"] = len(all_biomarkers)
            return result

        except Exception as exc:
            logger.error("openai_pdf_vision_analysis_failed error=%s", repr(exc), exc_info=True)
            return {
                "success": False,
                "error": str(exc),
                "error_code": self._get_error_code(exc),
            }

    @staticmethod
    async def _convert_pdf_to_images(pdf_path: str, max_pages: Optional[int] = None) -> List[str]:
        """Convert PDF pages to base64-encoded PNG images"""
        max_pages = max_pages or settings.tiff_max_pages

        try:
            images = convert_from_path(
                pdf_path,
                dpi=200,
                first_page=1,
                last_page=max_pages
            )

            base64_images = []
            for img in images:
                # Convert to PNG in memory
                with BytesIO() as img_byte_arr:
                    img.save(img_byte_arr, format='PNG')
                    img_byte_arr.seek(0)
                    base64_str = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')
                    base64_images.append(base64_str)

            return base64_images
        except Exception as e:
            logger.error("Failed to convert PDF to images: %s", repr(e))
            raise


class TIFFAnalyzer(PDFVisionAnalyzer):
    """Analyze TIFF files (multi-page documents)"""

    async def analyze(self, tiff_path: str, symptoms: Optional[List[str]] = None) -> dict[str, Any]:
        """Analyze TIFF as image(s)"""
        try:
            # For single-page TIFF, treat as image
            # For multi-page TIFF, convert each page and analyze
            img = Image.open(tiff_path)

            base64_images = []

            try:
                while True:
                    # Convert current page to base64
                    with BytesIO() as img_byte_arr:
                        img.save(img_byte_arr, format='PNG')
                        img_byte_arr.seek(0)
                        base64_str = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')
                        base64_images.append(base64_str)

                    # Try to get next page
                    img.seek(img.tell() + 1)
            except EOFError:
                pass  # No more pages

            # Analyze using vision (similar to PDFVisionAnalyzer)
            all_biomarkers = []
            extraction_notes = []
            document_metadata: dict[str, Any] = {}
            knowledge_context = await self._knowledge_context()
            for page_num, image_base64 in enumerate(base64_images, 1):
                prompt = self._build_extraction_prompt(
                    document_kind="TIFF lab report page",
                    symptoms=symptoms or [],
                    page_num=page_num,
                    knowledge_context=knowledge_context,
                )

                analysis_text = await self._send_vision_completion(image_base64, prompt)
                payload = self._parse_json(analysis_text)
                all_biomarkers.extend(payload.get("biomarkers", []))
                if isinstance(payload.get("extraction_notes"), list):
                    extraction_notes.extend(payload.get("extraction_notes", []))
                if not document_metadata and isinstance(payload.get("document_metadata"), dict):
                    document_metadata = payload.get("document_metadata") or {}

            result = {
                "success": True,
                "biomarkers": all_biomarkers,
                "protocol": [],
                "top_priority": [],
                "retest_schedule": [],
                "summary": {"document_type": "lab_report", "extracted_marker_count": len(all_biomarkers), "pages_analyzed": len(base64_images)},
                "document_metadata": document_metadata,
                "extraction_notes": extraction_notes,
                "analysis_method": "openai_tiff_vision",
                "biomarker_count": len(all_biomarkers),
            }
            return result

        except Exception as exc:
            logger.error("openai_tiff_analysis_failed error=%s", repr(exc), exc_info=True)
            return {
                "success": False,
                "error": str(exc),
                "error_code": "TIFF_ANALYSIS_ERROR",
            }


# Factory function to create appropriate analyzer
async def create_file_analyzer(file_path: str) -> OpenAIFileAnalyzer:
    """Create appropriate analyzer based on file type"""
    file_type = OpenAIFileAnalyzer._detect_file_type(file_path)

    if file_type == "pdf":
        # Determine if text-based or scanned
        text = OpenAIFileAnalyzer._extract_pdf_text_with_pypdf(file_path)
        if len(text.strip()) > 100:
            return PDFTextAnalyzer(api_key=settings.active_llm_api_key)
        else:
            return PDFVisionAnalyzer(api_key=settings.active_llm_api_key)
    elif file_type == "image":
        return ImageAnalyzer(api_key=settings.active_llm_api_key)
    elif file_type == "tiff":
        return TIFFAnalyzer(api_key=settings.active_llm_api_key)
    elif file_type == "table":
        from app.services.table_analyzer import TableAnalyzer
        return TableAnalyzer(api_key=settings.active_llm_api_key)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


# Backward compatibility aliases
class OpenAIPDFAnalyzer(PDFTextAnalyzer):
    """Backward-compatible alias for PDF analysis"""

    async def analyze_lab_pdf(self, pdf_path: str, symptoms: Optional[list[str]] = None) -> dict[str, Any]:
        """Legacy method for backward compatibility"""
        result = await self.analyze(pdf_path, symptoms)

        # Add legacy fields
        if result.get("success"):
            result["biomarker_count"] = len(result.get("biomarkers", []))

        return result


class ClaudePDFAnalyzer(OpenAIPDFAnalyzer):
    """Backward-compatible alias - despite the name, uses OpenAI API"""
    pass
