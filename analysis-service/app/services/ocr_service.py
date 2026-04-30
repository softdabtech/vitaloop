import io
import logging
import os
import re
from abc import ABC, abstractmethod
from typing import List

import cv2
import numpy as np
import pytesseract
from PIL import Image
from pdf2image import convert_from_bytes

logger = logging.getLogger(__name__)

SUPPORTED_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".webp")


class BaseOCREngine(ABC):
    name: str

    @abstractmethod
    def extract_from_image(self, image_bgr: np.ndarray) -> str:
        pass


class TesseractOCREngine(BaseOCREngine):
    name = "tesseract"

    def __init__(self) -> None:
        # Prioritize languages relevant to current user base; fallback to English-only.
        self._language_candidates = ["eng+spa+rus+ukr", "eng+spa", "eng"]
        self._config_candidates = [
            "--oem 3 --psm 6",
            "--oem 3 --psm 4",
            "--oem 3 --psm 11",
        ]

    def extract_from_image(self, image_bgr: np.ndarray) -> str:
        variants = self._build_variants(image_bgr)
        best_text = ""

        for variant in variants:
            for lang in self._language_candidates:
                for config in self._config_candidates:
                    try:
                        text = pytesseract.image_to_string(variant, lang=lang, config=config).strip()
                    except Exception:
                        continue
                    if len(text) > len(best_text):
                        best_text = text

        return best_text

    def _build_variants(self, image_bgr: np.ndarray) -> List[np.ndarray]:
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
        _, otsu = cv2.threshold(clahe, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        adaptive = cv2.adaptiveThreshold(
            clahe,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            35,
            11,
        )

        # Slight denoise while preserving edges for tabular documents.
        bilateral = cv2.bilateralFilter(gray, d=5, sigmaColor=35, sigmaSpace=35)
        _, bilateral_otsu = cv2.threshold(bilateral, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return [gray, clahe, otsu, adaptive, bilateral_otsu]


class PaddleOCREngine(BaseOCREngine):
    name = "paddle"

    def __init__(self) -> None:
        try:
            from paddleocr import PaddleOCR  # type: ignore

            self._ocr = PaddleOCR(use_angle_cls=True, lang="en")
        except Exception as exc:
            raise RuntimeError("PaddleOCR is not installed or failed to initialize") from exc

    def extract_from_image(self, image_bgr: np.ndarray) -> str:
        result = self._ocr.ocr(image_bgr, cls=True)
        lines: List[str] = []
        for block in result or []:
            for item in block or []:
                try:
                    text = str(item[1][0]).strip()
                except Exception:
                    text = ""
                if text:
                    lines.append(text)
        return "\n".join(lines).strip()


class SuryaOCREngine(BaseOCREngine):
    name = "surya"

    def __init__(self) -> None:
        raise RuntimeError("Surya OCR adapter placeholder: package wiring not enabled in this phase")

    def extract_from_image(self, image_bgr: np.ndarray) -> str:
        raise RuntimeError("Surya OCR adapter placeholder")


class OCRService:
    """OCR service with provider selection + fallback chain."""

    def __init__(self):
        provider = os.getenv("OCR_PROVIDER", "auto").strip().lower()
        fallback_chain_raw = os.getenv("OCR_FALLBACK_CHAIN", "").strip().lower()
        self.enable_mock_fallback = os.getenv("OCR_ENABLE_MOCK_FALLBACK", "false").strip().lower() == "true"
        self.min_signal_score = float(os.getenv("OCR_MIN_SIGNAL_SCORE", "3.2"))
        self.max_pdf_pages = int(os.getenv("OCR_MAX_PDF_PAGES", "2"))
        self.pdf_dpi = int(os.getenv("OCR_PDF_DPI", "180"))
        self.pdf_thread_count = int(os.getenv("OCR_PDF_THREAD_COUNT", "1"))

        if provider == "auto":
            requested_order: List[str] = ["paddle", "surya", "tesseract"]
        else:
            requested_order = [provider]

        if fallback_chain_raw:
            requested_order.extend([name.strip() for name in fallback_chain_raw.split(",") if name.strip()])
        if "tesseract" not in requested_order:
            requested_order.append("tesseract")

        self.engines: List[BaseOCREngine] = []
        for engine_name in requested_order:
            engine = self._build_engine(engine_name)
            if engine is not None and engine.name not in [e.name for e in self.engines]:
                self.engines.append(engine)

        if not self.engines:
            self.engines = [TesseractOCREngine()]

        logger.info(
            "OCR Service initialized provider=%s fallback_chain=%s mock_fallback=%s",
            provider,
            [engine.name for engine in self.engines],
            self.enable_mock_fallback,
        )

    def _build_engine(self, engine_name: str) -> BaseOCREngine | None:
        try:
            if engine_name == "tesseract":
                return TesseractOCREngine()
            if engine_name == "paddle":
                return PaddleOCREngine()
            if engine_name == "surya":
                return SuryaOCREngine()
        except Exception as exc:
            logger.warning("OCR engine %s unavailable: %s", engine_name, exc)
            return None
        logger.warning("Unknown OCR engine requested: %s", engine_name)
        return None

    async def extract_text(self, content: bytes, filename: str) -> str:
        """
        Extract text from file content using OCR
        Supports images (PNG, JPG, JPEG) and PDFs
        """
        try:
            filename_lower = filename.lower()

            if filename_lower.endswith(SUPPORTED_IMAGE_EXTENSIONS):
                return self._extract_text_from_image(content)
            elif filename_lower.endswith('.pdf'):
                return self._extract_text_from_pdf(content)
            else:
                # For unknown formats, try to treat as image
                logger.warning(f"Unknown file format {filename}, attempting image OCR")
                return self._extract_text_from_image(content)

        except Exception as e:
            logger.error(f"OCR extraction failed for {filename}: {str(e)}")
            if self.enable_mock_fallback:
                return self._get_mock_lab_data()
            return ""

    def _extract_text_from_image(self, image_bytes: bytes) -> str:
        """Extract text from image via configured OCR engine chain."""
        try:
            # Convert bytes to PIL Image
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

            # Convert PIL to OpenCV format
            opencv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

            combined_text = self._run_engine_chain(opencv_image)
            logger.info("OCR extracted %s characters from image", len(combined_text))

            if combined_text.strip():
                return combined_text.strip()
            if self.enable_mock_fallback:
                return self._get_mock_lab_data()
            return ""

        except Exception as e:
            logger.error(f"Image OCR failed: {str(e)}")
            if self.enable_mock_fallback:
                return self._get_mock_lab_data()
            return ""

    def _run_engine_chain(self, image_bgr: np.ndarray) -> str:
        # Cap very large inputs to reduce memory pressure while preserving readability.
        h, w = image_bgr.shape[:2]
        max_side = 2200
        if max(h, w) > max_side:
            scale = max_side / float(max(h, w))
            image_bgr = cv2.resize(image_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

        best_text = ""
        best_engine = "none"
        best_score = -1.0

        for engine in self.engines:
            try:
                text = engine.extract_from_image(image_bgr).strip()
            except Exception as exc:
                logger.warning("OCR engine failed name=%s error=%s", engine.name, exc)
                continue

            score = self._text_signal_score(text)
            logger.info("OCR engine result name=%s chars=%s signal=%.2f", engine.name, len(text), score)

            if score > best_score:
                best_text = text
                best_engine = engine.name
                best_score = score

            # Stop early if text has strong lab-like signal.
            if score >= self.min_signal_score and len(text) >= 120:
                logger.info("OCR engine success name=%s chars=%s signal=%.2f", engine.name, len(text), score)
                return text

        logger.info("OCR best result engine=%s chars=%s signal=%.2f", best_engine, len(best_text), best_score)
        return best_text

    def _text_signal_score(self, text: str) -> float:
        """Estimate whether OCR output looks like a lab report payload."""
        if not text:
            return 0.0

        t = text.lower()
        score = 0.0

        # Baseline volume signal.
        score += min(len(text) / 120.0, 1.4)

        # Numeric density matters for lab sheets.
        numeric_hits = len(re.findall(r"\d+(?:[.,]\d+)?", text))
        score += min(numeric_hits / 10.0, 1.2)

        # Biomarker keywords and units.
        keywords = [
            "hemoglobin", "hematocrit", "rbc", "wbc", "platelet", "glucose", "cholesterol",
            "triglycer", "creatinine", "tsh", "esr", "ferritin", "витамин", "гемоглобин", "лейкоцит",
        ]
        units = ["mg/dl", "g/dl", "mmol", "iu/l", "u/l", "%", "10^", "x10"]
        score += min(sum(1 for k in keywords if k in t) * 0.22, 1.4)
        score += min(sum(1 for u in units if u in t) * 0.2, 1.0)

        # Reference range shape.
        range_hits = len(re.findall(r"\d+(?:[.,]\d+)?\s*[-–]\s*\d+(?:[.,]\d+)?", text))
        score += min(range_hits * 0.2, 1.0)
        return score

    def _extract_text_from_pdf(self, pdf_bytes: bytes) -> str:
        """Extract text from PDF by converting pages to images and OCRing each page."""
        try:
            logger.info("Converting PDF to images for OCR processing")

            # Convert PDF pages to images
            last_page = self.max_pdf_pages if self.max_pdf_pages > 0 else None
            images = convert_from_bytes(
                pdf_bytes,
                dpi=self.pdf_dpi,
                fmt="jpeg",
                thread_count=max(1, self.pdf_thread_count),
                first_page=1,
                last_page=last_page,
            )

            extracted_texts = []

            for i, image in enumerate(images):
                logger.info(f"Processing PDF page {i + 1}/{len(images)}")

                opencv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
                page_text = self._run_engine_chain(opencv_image)
                if page_text.strip():
                    extracted_texts.append(page_text.strip())

            # Combine all pages
            combined_text = "\n\n".join(extracted_texts)

            logger.info("PDF OCR extracted %s characters from %s pages", len(combined_text), len(images))
            if combined_text.strip():
                return combined_text.strip()
            if self.enable_mock_fallback:
                return self._get_mock_lab_data()
            return ""

        except Exception as e:
            logger.error(f"PDF extraction failed: {str(e)}")
            if self.enable_mock_fallback:
                return self._get_mock_lab_data()
            return ""

    def _get_mock_lab_data(self) -> str:
        """Return mock lab data for testing/fallback"""
        return """
Complete Blood Count (CBC)
Patient: John Doe
Date: 2024-01-15

HEMOGLOBIN: 14.2 g/dL (13.5-17.5)
HEMATOCRIT: 42.1% (41.0-53.0)
WBC: 7.8 x10^3/uL (4.0-11.0)
RBC: 4.8 x10^6/uL (4.5-5.9)
PLATELETS: 285 x10^3/uL (150-450)

Comprehensive Metabolic Panel
GLUCOSE: 95 mg/dL (70-99)
BUN: 18 mg/dL (7-20)
CREATININE: 0.9 mg/dL (0.7-1.2)
eGFR: 95 mL/min (>60)
SODIUM: 140 mEq/L (136-145)
POTASSIUM: 4.2 mEq/L (3.5-5.0)
CHLORIDE: 102 mEq/L (98-107)
CO2: 25 mEq/L (22-28)
CALCIUM: 9.8 mg/dL (8.5-10.5)
ALBUMIN: 4.2 g/dL (3.5-5.0)
TOTAL PROTEIN: 7.1 g/dL (6.0-8.5)

Lipid Panel
TOTAL CHOLESTEROL: 185 mg/dL (<200)
HDL: 55 mg/dL (>40)
LDL: 110 mg/dL (<100)
TRIGLYCERIDES: 120 mg/dL (<150)

Thyroid Panel
TSH: 2.1 mIU/L (0.4-4.0)
FREE T4: 1.2 ng/dL (0.8-1.8)
FREE T3: 3.1 pg/mL (2.3-4.2)

Liver Function
ALT: 28 U/L (7-56)
AST: 25 U/L (10-40)
ALKALINE PHOSPHATASE: 85 U/L (44-147)
TOTAL BILIRUBIN: 0.8 mg/dL (0.3-1.2)
""".strip()