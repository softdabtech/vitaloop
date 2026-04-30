from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Dict, Any
from app.services.ocr_service import OCRService
from app.services.medical_analyzer import MedicalAnalyzer

router = APIRouter()
ocr_service = OCRService()
medical_analyzer = MedicalAnalyzer()

class TextAnalysisRequest(BaseModel):
    text: str

class AnalysisResponse(BaseModel):
    biomarkers: List[Dict[str, Any]]
    recommendations: List[str]

@router.post("/analyze/text", response_model=AnalysisResponse)
async def analyze_text(text: str = Form(...)):
    """Analyze lab results from text input"""
    try:
        # Extract biomarkers from text
        biomarkers = await medical_analyzer.analyze_biomarkers(text)

        # Generate recommendations
        recommendations = medical_analyzer.generate_recommendations(biomarkers)

        return {
            "biomarkers": biomarkers,
            "recommendations": recommendations
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_file(file: UploadFile = File(...)):
    """Analyze lab results from uploaded file"""
    try:
        # Read file content
        content = await file.read()

        # Extract text from file (PDF/image)
        extracted_text = await ocr_service.extract_text(content, file.filename)

        # Analyze biomarkers
        biomarkers = await medical_analyzer.analyze_biomarkers(extracted_text)

        # Generate recommendations
        recommendations = medical_analyzer.generate_recommendations(biomarkers)

        return {
            "biomarkers": biomarkers,
            "recommendations": recommendations
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.get("/biomarkers/reference")
async def get_biomarker_reference():
    """Get reference ranges for all biomarkers"""
    try:
        reference_data = medical_analyzer.get_reference_ranges()
        return {"biomarkers": reference_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get reference data: {str(e)}")