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

from app.config import settings

logger = logging.getLogger("uvicorn.error")


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
    def _extract_pdf_text(pdf_path: str, max_length: int = 80000) -> str:
        """Extract text from PDF file"""
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
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_base64
                            }
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
            "top_priority": result.get("top_priority", []),
            "protocol": result.get("protocol", []),
            "retest_schedule": result.get("retest_schedule", []),
            "summary": result.get("summary", {}),
            "analysis_method": analysis_method,
        }


class PDFTextAnalyzer(OpenAIFileAnalyzer):
    """Analyze text-based PDF files"""

    async def analyze(self, pdf_path: str, symptoms: Optional[List[str]] = None) -> dict[str, Any]:
        start_time = time.time()

        try:
            # Validate and extract
            if not self._validate_pdf(pdf_path):
                raise ValueError("Invalid PDF format or file too large")

            extracted_text = self._extract_pdf_text(pdf_path)
            if len(extracted_text.strip()) < 50:
                raise ValueError("Could not extract readable text from PDF")

            # Prepare prompt
            symptoms = symptoms or []
            symptoms_text = f"\n\nUser-reported symptoms: {', '.join(symptoms)}" if symptoms else ""

            prompt = f"""You are an expert medical lab analyst. Analyze this lab report text.

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

LAB REPORT TEXT:
{extracted_text[:80000]}

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
            logger.debug(f"OpenAI response (first 500 chars): {analysis_text[:500]}")

            try:
                payload = self._parse_json(analysis_text)
            except json.JSONDecodeError as e:
                logger.error(f"JSON parsing failed: {e}, response: {analysis_text[:1000]}")
                raise ValueError(f"API returned invalid JSON: {str(e)}")

            # Validate required fields
            required_fields = ["biomarkers", "protocol", "retest_schedule"]
            if not all(field in payload for field in required_fields):
                logger.error(f"Missing fields in response. Got: {list(payload.keys())}")
                raise ValueError("Response missing required fields")

            analysis_time = time.time() - start_time
            biomarkers = payload.get("biomarkers", [])

            logger.info(
                "openai_pdf_text_analysis_ok biomarkers=%s protocol=%s duration_ms=%s",
                len(biomarkers),
                len(payload.get("protocol", [])),
                int(analysis_time * 1000),
            )

            result = self._normalize_response(payload, "openai_pdf_text")
            result["analysis_time"] = analysis_time
            result["biomarker_count"] = len(biomarkers)
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

            # Prepare prompt
            symptoms = symptoms or []
            symptoms_text = f"\n\nUser-reported symptoms: {', '.join(symptoms)}" if symptoms else ""

            prompt = f"""You are an expert medical lab analyst. Analyze this lab report image carefully.

ANALYSIS REQUIREMENTS:
1. Extract ALL biomarkers visible in the report with values and reference ranges
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
  "top_priority": [...],
  "protocol": [...],
  "retest_schedule": [...],
  "summary": {{...}}
}}"""

            # Send to Vision API
            analysis_text = await self._send_vision_completion(image_base64, prompt)
            payload = self._parse_json(analysis_text)

            # Validate
            required_fields = ["biomarkers", "protocol"]
            if not all(field in payload for field in required_fields):
                raise ValueError("Response missing required fields")

            analysis_time = time.time() - start_time
            biomarkers = payload.get("biomarkers", [])

            logger.info(
                "openai_vision_analysis_ok biomarkers=%s protocol=%s duration_ms=%s",
                len(biomarkers),
                len(payload.get("protocol", [])),
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
            all_protocols = []

            for page_num, image_base64 in enumerate(images, 1):
                logger.info("Analyzing page %d of %d", page_num, len(images))

                symptoms_text = f"\n\nUser-reported symptoms: {', '.join(symptoms or [])}" if symptoms else ""

                prompt = f"""You are an expert medical lab analyst. Analyze this lab report page (page {page_num}).

Extract ALL biomarkers with values and reference ranges.
Return ONLY valid JSON:
{{
  "biomarkers": [...],
  "protocol": [...],
  "top_priority": [...],
  "retest_schedule": [...],
  "summary": {{...}}
}}"""

                analysis_text = await self._send_vision_completion(image_base64, prompt)
                payload = self._parse_json(analysis_text)

                all_biomarkers.extend(payload.get("biomarkers", []))
                all_protocols.extend(payload.get("protocol", []))

            # Merge results
            merged_payload = {
                "biomarkers": all_biomarkers,
                "protocol": all_protocols,
                "top_priority": [],
                "retest_schedule": [],
                "summary": {"key_findings": f"Analyzed {len(images)} page(s)"}
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
            for page_num, image_base64 in enumerate(base64_images, 1):
                symptoms_text = f"\n\nUser-reported symptoms: {', '.join(symptoms or [])}" if symptoms else ""

                prompt = f"""Analyze this lab report page {page_num}. Extract biomarkers.
Return ONLY JSON: {{"biomarkers": [...], "protocol": [...], "top_priority": [], "retest_schedule": [], "summary": {{}}}}"""

                analysis_text = await self._send_vision_completion(image_base64, prompt)
                payload = self._parse_json(analysis_text)
                all_biomarkers.extend(payload.get("biomarkers", []))

            result = {
                "success": True,
                "biomarkers": all_biomarkers,
                "protocol": [],
                "top_priority": [],
                "retest_schedule": [],
                "summary": {},
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
        text = OpenAIFileAnalyzer._extract_pdf_text(file_path)
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
