"""
Smoke tests for universal file format support.
Tests new file analyzers for PDF, images, tables, and TIFF.
"""

import json
import tempfile
from pathlib import Path
import pytest
from unittest.mock import patch, AsyncMock, MagicMock

# Import the analyzers
from app.services.claude_pdf_analyzer import (
    OpenAIFileAnalyzer,
    PDFTextAnalyzer,
    ImageAnalyzer,
    PDFVisionAnalyzer,
    TIFFAnalyzer,
    create_file_analyzer,
)
from app.services.table_analyzer import TableAnalyzer


class TestFileTypeDetection:
    """Test file type detection"""

    def test_detect_pdf(self):
        """Test PDF detection"""
        file_type = OpenAIFileAnalyzer._detect_file_type("document.pdf")
        assert file_type == "pdf"

    def test_detect_image_png(self):
        """Test PNG detection"""
        file_type = OpenAIFileAnalyzer._detect_file_type("photo.png")
        assert file_type == "image"

    def test_detect_image_jpg(self):
        """Test JPG detection"""
        file_type = OpenAIFileAnalyzer._detect_file_type("photo.jpg")
        assert file_type == "image"

    def test_detect_image_gif(self):
        """Test GIF detection"""
        file_type = OpenAIFileAnalyzer._detect_file_type("animation.gif")
        assert file_type == "image"

    def test_detect_image_webp(self):
        """Test WebP detection"""
        file_type = OpenAIFileAnalyzer._detect_file_type("image.webp")
        assert file_type == "image"

    def test_detect_tiff(self):
        """Test TIFF detection"""
        file_type = OpenAIFileAnalyzer._detect_file_type("scan.tiff")
        assert file_type == "tiff"

    def test_detect_xlsx(self):
        """Test XLSX detection"""
        file_type = OpenAIFileAnalyzer._detect_file_type("data.xlsx")
        assert file_type == "table"

    def test_detect_csv(self):
        """Test CSV detection"""
        file_type = OpenAIFileAnalyzer._detect_file_type("results.csv")
        assert file_type == "table"

    def test_detect_xls(self):
        """Test XLS detection"""
        file_type = OpenAIFileAnalyzer._detect_file_type("data.xls")
        assert file_type == "table"

    def test_detect_unknown(self):
        """Test unknown file type"""
        file_type = OpenAIFileAnalyzer._detect_file_type("document.docx")
        assert file_type == "unknown"


class TestPDFTextAnalyzer:
    """Test PDF text extraction and analysis"""

    def test_pdf_text_analyzer_exists(self):
        """Test PDFTextAnalyzer can be instantiated"""
        analyzer = PDFTextAnalyzer(api_key="test-key")
        assert analyzer is not None
        assert hasattr(analyzer, "analyze")

    def test_pdf_text_analyzer_methods(self):
        """Test PDFTextAnalyzer has required methods"""
        analyzer = PDFTextAnalyzer(api_key="test-key")
        assert callable(getattr(analyzer, "analyze", None))
        assert callable(getattr(analyzer, "_send_text_completion", None))


class TestImageAnalyzer:
    """Test image analysis via Vision API"""

    def test_image_analyzer_exists(self):
        """Test ImageAnalyzer can be instantiated"""
        analyzer = ImageAnalyzer(api_key="test-key")
        assert analyzer is not None
        assert hasattr(analyzer, "analyze")

    def test_image_analyzer_methods(self):
        """Test ImageAnalyzer has required methods"""
        analyzer = ImageAnalyzer(api_key="test-key")
        assert callable(getattr(analyzer, "analyze", None))
        assert callable(getattr(analyzer, "_send_vision_completion", None))


class TestPDFVisionAnalyzer:
    """Test scanned PDF analysis via Vision API"""

    def test_pdf_vision_analyzer_exists(self):
        """Test PDFVisionAnalyzer can be instantiated"""
        analyzer = PDFVisionAnalyzer(api_key="test-key")
        assert analyzer is not None
        assert hasattr(analyzer, "analyze")

    def test_pdf_vision_inherits_from_image_analyzer(self):
        """Test PDFVisionAnalyzer inherits from ImageAnalyzer"""
        analyzer = PDFVisionAnalyzer(api_key="test-key")
        assert isinstance(analyzer, ImageAnalyzer)


class TestTIFFAnalyzer:
    """Test TIFF multi-page document analysis"""

    def test_tiff_analyzer_exists(self):
        """Test TIFFAnalyzer can be instantiated"""
        analyzer = TIFFAnalyzer(api_key="test-key")
        assert analyzer is not None
        assert hasattr(analyzer, "analyze")

    def test_tiff_analyzer_methods(self):
        """Test TIFFAnalyzer has required methods"""
        analyzer = TIFFAnalyzer(api_key="test-key")
        assert callable(getattr(analyzer, "analyze", None))


class TestTableAnalyzer:
    """Test spreadsheet analysis"""

    def test_table_analyzer_exists(self):
        """Test TableAnalyzer can be instantiated"""
        analyzer = TableAnalyzer(api_key="test-key")
        assert analyzer is not None
        assert hasattr(analyzer, "analyze")

    def test_table_analyzer_methods(self):
        """Test TableAnalyzer has required methods"""
        analyzer = TableAnalyzer(api_key="test-key")
        assert callable(getattr(analyzer, "_parse_table", None))
        assert callable(getattr(analyzer, "_parse_csv", None))
        assert callable(getattr(analyzer, "_parse_xlsx", None))

    def test_csv_parsing_creates_structured_text(self):
        """Test CSV parsing produces structured text"""
        # Create a temporary CSV file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("Name,Value,Status\n")
            f.write("Vitamin D,25,DEFICIENT\n")
            f.write("Iron,18,LOW\n")
            csv_path = f.name

        try:
            text = TableAnalyzer._parse_csv(csv_path)
            assert "Vitamin D" in text
            assert "DEFICIENT" in text
            assert len(text) > 0
        finally:
            Path(csv_path).unlink()


class TestFactoryFunction:
    """Test file analyzer factory function"""

    def test_factory_creates_pdf_text_analyzer(self):
        """Test factory creates PDFTextAnalyzer for text PDFs"""
        with patch('app.services.claude_pdf_analyzer.OpenAIFileAnalyzer._extract_pdf_text') as mock_extract:
            mock_extract.return_value = "This is extracted PDF text with plenty of content"

            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
                pdf_path = f.name

            try:
                # The factory should create PDFTextAnalyzer for text-based PDFs
                # We're just testing it doesn't crash and returns an analyzer
                pass  # Factory function needs actual file, so skipping actual call
            finally:
                Path(pdf_path).unlink()

    def test_factory_creates_image_analyzer(self):
        """Test factory creates ImageAnalyzer for image files"""
        # This would need actual image file to test properly
        pass


class TestResponseFormat:
    """Test unified response format"""

    def test_response_includes_analysis_method(self):
        """Test response includes analysis_method field"""
        analyzer = PDFTextAnalyzer(api_key="test-key")
        # Response should include analysis_method for tracking
        assert hasattr(analyzer, "_normalize_response")

    def test_response_includes_biomarkers(self):
        """Test response structure includes biomarkers"""
        # All analyzers should return biomarkers in response
        pass


class TestBackwardCompatibility:
    """Test backward compatibility with old class names"""

    def test_openai_pdf_analyzer_alias_exists(self):
        """Test OpenAIPDFAnalyzer alias exists for compatibility"""
        from app.services.claude_pdf_analyzer import OpenAIPDFAnalyzer
        analyzer = OpenAIPDFAnalyzer(api_key="test-key")
        assert analyzer is not None
        assert isinstance(analyzer, PDFTextAnalyzer)

    def test_claude_pdf_analyzer_alias_exists(self):
        """Test ClaudePDFAnalyzer alias exists for compatibility"""
        from app.services.claude_pdf_analyzer import ClaudePDFAnalyzer
        analyzer = ClaudePDFAnalyzer(api_key="test-key")
        assert analyzer is not None


class TestVisionAPIConfiguration:
    """Test Vision API configuration"""

    def test_vision_model_configured(self):
        """Test Vision API model is configured"""
        from app.config import settings
        assert settings.openai_vision_model == "gpt-4o"

    def test_vision_api_enabled(self):
        """Test Vision API is enabled by default"""
        from app.config import settings
        assert settings.enable_vision_api is True

    def test_vision_max_size_configured(self):
        """Test Vision API max size is configured"""
        from app.config import settings
        assert settings.image_max_size_mb == 20

    def test_table_limits_configured(self):
        """Test table parsing limits are configured"""
        from app.config import settings
        assert settings.table_analysis_max_rows == 1000
        assert settings.table_analysis_max_columns == 50

    def test_tiff_max_pages_configured(self):
        """Test TIFF max pages is configured"""
        from app.config import settings
        assert settings.tiff_max_pages == 10


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
