# Analysis Service

Medical lab analysis microservice for VITALOOP platform.

## Features

- **OCR Processing**: Extract text from lab reports (PDF/images)
- **Biomarker Analysis**: Analyze 20+ medical biomarkers
- **Reference Ranges**: Comprehensive reference ranges for all markers
- **Recommendations**: AI-powered health recommendations
- **REST API**: FastAPI-based RESTful API

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