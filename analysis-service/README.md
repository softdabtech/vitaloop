# Analysis Service

Medical lab analysis microservice for VITALOOP platform.

## Features

- **OCR Processing**: Extract text from lab reports (PDF/images)
- **Provider Chain**: Configurable OCR provider and fallback sequence
- **Biomarker Analysis**: Analyze 20+ medical biomarkers
- **Reference Ranges**: Comprehensive reference ranges for all markers
- **Recommendations**: AI-powered health recommendations
- **REST API**: FastAPI-based RESTful API

## OCR Configuration

The service supports provider-based OCR routing.

- `OCR_PROVIDER` - primary OCR engine (`tesseract`, `paddle`, `surya`)
- `OCR_FALLBACK_CHAIN` - comma-separated fallback engines
- `OCR_ENABLE_MOCK_FALLBACK` - `true` only for local demo/testing

Current default rollout is safe mode:

- `OCR_PROVIDER=tesseract`
- `OCR_FALLBACK_CHAIN=`
- `OCR_ENABLE_MOCK_FALLBACK=false`

Production memory-safe defaults:

- `OCR_PROVIDER=auto`
- `OCR_FALLBACK_CHAIN=tesseract`
- `OCR_MAX_PDF_PAGES=2`
- `OCR_PDF_DPI=180`
- `OCR_PDF_THREAD_COUNT=1`

### Optional Paddle Provider (Phase 2)

Install optional dependencies when host capacity allows it:

```bash
pip install -r requirements-paddle.txt
```

Then set provider env for canary:

```bash
export OCR_PROVIDER=paddle
export OCR_FALLBACK_CHAIN=tesseract
```

### OCR Benchmark Harness

Run benchmark on fixture files via public API:

```bash
python scripts/benchmark_ocr.py \
	--base-url https://vitaloop.today \
	--fixtures ../scripts/smoke-fixtures/*.{png,pdf} \
	--json ./benchmark-report.json
```

## Supported Biomarkers

### Metabolism
- Glucose, HbA1C

### Lipids
- Total Cholesterol, HDL, LDL, Triglycerides

### Liver Function
- ALT, AST, Alkaline Phosphatase, Bilirubin

### Kidney Function
- Creatinine, BUN, eGFR

### Blood Count
- WBC, RBC, Hemoglobin, Hematocrit, Platelets

### Thyroid
- TSH, Free T4, Free T3

## API Endpoints

- `GET /health` - Health check
- `POST /api/v1/analyze/text` - Analyze text input
- `POST /api/v1/analyze` - Analyze uploaded file
- `GET /api/v1/biomarkers/reference` - Get reference ranges

## Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run locally
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8006
```

## Deployment

```bash
# Direct deployment to server
./scripts/deploy-analysis-service-direct.sh

# Docker deployment
./scripts/deploy-analysis-service.sh
```

## Production

Service runs on port 8006 with automatic health monitoring and logging.