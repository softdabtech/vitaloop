import re
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class MedicalAnalyzer:
    """Service for analyzing medical biomarkers and generating recommendations"""

    def __init__(self):
        self.biomarker_ranges = self._load_biomarker_ranges()

    def _load_biomarker_ranges(self) -> Dict[str, Dict]:
        """Load reference ranges for biomarkers"""
        return {
            "glucose": {
                "name": "Glucose",
                "unit": "mg/dL",
                "ranges": {
                    "normal": {"min": 70, "max": 99},
                    "prediabetic": {"min": 100, "max": 125},
                    "diabetic": {"min": 126, "max": 200}
                },
                "category": "Metabolism"
            },
            "hemoglobin": {
                "name": "Hemoglobin",
                "unit": "g/dL",
                "ranges": {
                    "low": {"max": 12.0},
                    "normal": {"min": 12.0, "max": 15.5},
                    "high": {"min": 15.5}
                },
                "category": "Blood"
            },
            "wbc": {
                "name": "White Blood Cells",
                "unit": "x10^3/uL",
                "ranges": {
                    "low": {"max": 4.0},
                    "normal": {"min": 4.0, "max": 11.0},
                    "high": {"min": 11.0}
                },
                "category": "Blood"
            },
            "rbc": {
                "name": "Red Blood Cells",
                "unit": "x10^6/uL",
                "ranges": {
                    "low": {"max": 4.5},
                    "normal": {"min": 4.5, "max": 5.9},
                    "high": {"min": 5.9}
                },
                "category": "Blood"
            },
            "platelets": {
                "name": "Platelets",
                "unit": "x10^3/uL",
                "ranges": {
                    "low": {"max": 150},
                    "normal": {"min": 150, "max": 450},
                    "high": {"min": 450}
                },
                "category": "Blood"
            },
            "cholesterol": {
                "name": "Total Cholesterol",
                "unit": "mg/dL",
                "ranges": {
                    "optimal": {"max": 200},
                    "borderline": {"min": 200, "max": 239},
                    "high": {"min": 240}
                },
                "category": "Lipids"
            },
            "hdl": {
                "name": "HDL Cholesterol",
                "unit": "mg/dL",
                "ranges": {
                    "low": {"max": 40},
                    "normal": {"min": 40, "max": 60},
                    "protective": {"min": 60}
                },
                "category": "Lipids"
            },
            "ldl": {
                "name": "LDL Cholesterol",
                "unit": "mg/dL",
                "ranges": {
                    "optimal": {"max": 100},
                    "near_optimal": {"min": 100, "max": 129},
                    "borderline": {"min": 130, "max": 159},
                    "high": {"min": 160, "max": 189},
                    "very_high": {"min": 190}
                },
                "category": "Lipids"
            },
            "triglycerides": {
                "name": "Triglycerides",
                "unit": "mg/dL",
                "ranges": {
                    "normal": {"max": 150},
                    "borderline": {"min": 150, "max": 199},
                    "high": {"min": 200, "max": 499},
                    "very_high": {"min": 500}
                },
                "category": "Lipids"
            },
            "alt": {
                "name": "ALT",
                "unit": "U/L",
                "ranges": {
                    "normal": {"min": 7, "max": 56}
                },
                "category": "Liver"
            },
            "ast": {
                "name": "AST",
                "unit": "U/L",
                "ranges": {
                    "normal": {"min": 10, "max": 40}
                },
                "category": "Liver"
            },
            "creatinine": {
                "name": "Creatinine",
                "unit": "mg/dL",
                "ranges": {
                    "normal": {"min": 0.7, "max": 1.2}
                },
                "category": "Kidney"
            },
            "egfr": {
                "name": "eGFR",
                "unit": "mL/min",
                "ranges": {
                    "normal": {"min": 60},
                    "mild": {"min": 45, "max": 59},
                    "moderate": {"min": 30, "max": 44},
                    "severe": {"min": 15, "max": 29},
                    "kidney_failure": {"max": 15}
                },
                "category": "Kidney"
            },
            "tsh": {
                "name": "TSH",
                "unit": "mIU/L",
                "ranges": {
                    "normal": {"min": 0.4, "max": 4.0},
                    "hypothyroid": {"min": 4.0},
                    "hyperthyroid": {"max": 0.4}
                },
                "category": "Thyroid"
            },
            "t4": {
                "name": "Free T4",
                "unit": "ng/dL",
                "ranges": {
                    "normal": {"min": 0.8, "max": 1.8}
                },
                "category": "Thyroid"
            },
            "t3": {
                "name": "Free T3",
                "unit": "pg/mL",
                "ranges": {
                    "normal": {"min": 2.3, "max": 4.2}
                },
                "category": "Thyroid"
            }
        }

    async def analyze_biomarkers(self, text: str) -> List[Dict[str, Any]]:
        """Extract and analyze biomarkers from lab text"""
        biomarkers = []

        # Extract biomarker values using regex patterns
        biomarker_patterns = {
            "glucose": r"GLUCOSE:?\s*(\d+(?:\.\d+)?)\s*mg/dL",
            "hemoglobin": r"HEMOGLOBIN:?\s*(\d+(?:\.\d+)?)\s*g/dL",
            "wbc": r"WBC:?\s*(\d+(?:\.\d+)?)\s*x10\^?3/?uL",
            "rbc": r"RBC:?\s*(\d+(?:\.\d+)?)\s*x10\^?6/?uL",
            "platelets": r"PLATELETS?:?\s*(\d+(?:\.\d+)?)\s*x10\^?3/?uL",
            "cholesterol": r"(?:TOTAL\s+)?CHOLESTEROL:?\s*(\d+(?:\.\d+)?)\s*mg/dL",
            "hdl": r"HDL:?\s*(\d+(?:\.\d+)?)\s*mg/dL",
            "ldl": r"LDL:?\s*(\d+(?:\.\d+)?)\s*mg/dL",
            "triglycerides": r"TRIGLYCERIDES?:?\s*(\d+(?:\.\d+)?)\s*mg/dL",
            "alt": r"ALT:?\s*(\d+(?:\.\d+)?)\s*U/L",
            "ast": r"AST:?\s*(\d+(?:\.\d+)?)\s*U/L",
            "creatinine": r"CREATININE:?\s*(\d+(?:\.\d+)?)\s*mg/dL",
            "egfr": r"eGFR:?\s*(\d+(?:\.\d+)?)\s*mL/min",
            "tsh": r"TSH:?\s*(\d+(?:\.\d+)?)\s*mIU/L",
            "t4": r"FREE\s*T4:?\s*(\d+(?:\.\d+)?)\s*ng/dL",
            "t3": r"FREE\s*T3:?\s*(\d+(?:\.\d+)?)\s*pg/mL"
        }

        for biomarker_key, pattern in biomarker_patterns.items():
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                value = float(match.group(1))
                analysis = self._analyze_single_biomarker(biomarker_key, value)
                if analysis:
                    biomarkers.append(analysis)

        logger.info(f"Extracted {len(biomarkers)} biomarkers from text")
        return biomarkers

    def _analyze_single_biomarker(self, biomarker_key: str, value: float) -> Optional[Dict[str, Any]]:
        """Analyze a single biomarker value"""
        if biomarker_key not in self.biomarker_ranges:
            return None

        biomarker_info = self.biomarker_ranges[biomarker_key]
        ranges = biomarker_info["ranges"]

        # Determine status
        status = "unknown"
        for range_name, range_values in ranges.items():
            min_val = range_values.get("min", float("-inf"))
            max_val = range_values.get("max", float("inf"))

            if min_val <= value <= max_val:
                status = range_name
                break

        return {
            "name": biomarker_info["name"],
            "key": biomarker_key,
            "value": value,
            "unit": biomarker_info["unit"],
            "status": status,
            "category": biomarker_info["category"],
            "reference_ranges": ranges,
            "interpretation": self._get_interpretation(biomarker_key, status),
            "recommendations": self._get_biomarker_recommendations(biomarker_key, status)
        }

    def _get_interpretation(self, biomarker_key: str, status: str) -> str:
        """Get clinical interpretation for biomarker status"""
        interpretations = {
            "glucose": {
                "normal": "Blood glucose is within normal range",
                "prediabetic": "Blood glucose is elevated, indicating prediabetes",
                "diabetic": "Blood glucose is high, indicating diabetes"
            },
            "hemoglobin": {
                "low": "Hemoglobin is below normal range (anemia)",
                "normal": "Hemoglobin is within normal range",
                "high": "Hemoglobin is above normal range"
            },
            "cholesterol": {
                "optimal": "Total cholesterol is optimal",
                "borderline": "Total cholesterol is borderline high",
                "high": "Total cholesterol is high"
            },
            "hdl": {
                "low": "HDL cholesterol is low (increased cardiovascular risk)",
                "normal": "HDL cholesterol is adequate",
                "protective": "HDL cholesterol is protective against heart disease"
            },
            "ldl": {
                "optimal": "LDL cholesterol is optimal",
                "near_optimal": "LDL cholesterol is near optimal",
                "borderline": "LDL cholesterol is borderline high",
                "high": "LDL cholesterol is high",
                "very_high": "LDL cholesterol is very high"
            }
        }

        biomarker_interpretations = interpretations.get(biomarker_key, {})
        return biomarker_interpretations.get(status, f"{status.title()} level detected")

    def _get_biomarker_recommendations(self, biomarker_key: str, status: str) -> List[str]:
        """Get recommendations for biomarker status"""
        recommendations = {
            "glucose": {
                "prediabetic": [
                    "Consider lifestyle modifications",
                    "Regular exercise (150 minutes/week)",
                    "Weight management if overweight",
                    "Follow-up glucose testing"
                ],
                "diabetic": [
                    "Consult endocrinologist",
                    "Blood glucose monitoring",
                    "Diabetes management plan",
                    "Regular HbA1c testing"
                ]
            },
            "hemoglobin": {
                "low": [
                    "Evaluate for anemia causes",
                    "Check iron, B12, folate levels",
                    "Consider dietary iron intake",
                    "Follow-up CBC in 4-6 weeks"
                ]
            },
            "cholesterol": {
                "borderline": [
                    "Heart-healthy diet",
                    "Regular exercise",
                    "Consider lipid profile recheck in 3-6 months"
                ],
                "high": [
                    "Consult cardiologist",
                    "Consider statin therapy",
                    "Lifestyle modifications",
                    "Regular lipid monitoring"
                ]
            },
            "hdl": {
                "low": [
                    "Increase physical activity",
                    "Healthy diet with omega-3 fatty acids",
                    "Consider niacin or fibrate therapy",
                    "Quit smoking if applicable"
                ]
            },
            "ldl": {
                "high": [
                    "Statin therapy consideration",
                    "Dietary modifications",
                    "Regular exercise",
                    "Cardiovascular risk assessment"
                ],
                "very_high": [
                    "Immediate cardiology consultation",
                    "Aggressive lipid-lowering therapy",
                    "Comprehensive cardiovascular evaluation"
                ]
            }
        }

        biomarker_recs = recommendations.get(biomarker_key, {})
        return biomarker_recs.get(status, [])

    def generate_recommendations(self, biomarkers: List[Dict[str, Any]]) -> List[str]:
        """Generate overall recommendations based on all biomarkers"""
        recommendations = []

        # Check for critical abnormalities
        critical_markers = []
        for biomarker in biomarkers:
            if biomarker["status"] in ["high", "low", "diabetic", "very_high", "severe", "kidney_failure"]:
                critical_markers.append(biomarker["name"])

        if critical_markers:
            recommendations.append(f"⚠️ URGENT: Abnormal results in {', '.join(critical_markers)}. Consult healthcare provider immediately.")

        # Check for metabolic syndrome indicators
        metabolic_indicators = []
        for biomarker in biomarkers:
            if biomarker["key"] == "glucose" and biomarker["status"] in ["prediabetic", "diabetic"]:
                metabolic_indicators.append("elevated glucose")
            elif biomarker["key"] == "triglycerides" and biomarker["status"] in ["high", "very_high"]:
                metabolic_indicators.append("high triglycerides")
            elif biomarker["key"] == "hdl" and biomarker["status"] == "low":
                metabolic_indicators.append("low HDL")

        if len(metabolic_indicators) >= 2:
            recommendations.append("💡 Consider metabolic syndrome evaluation - multiple cardiovascular risk factors present.")

        # General recommendations
        if any(b["status"] != "normal" and b["status"] != "optimal" for b in biomarkers):
            recommendations.extend([
                "📅 Schedule follow-up appointment with healthcare provider",
                "📊 Bring these results to your next doctor's visit",
                "💊 Discuss treatment options if applicable"
            ])

        # Preventive recommendations
        recommendations.extend([
            "🥗 Maintain healthy diet and regular exercise",
            "📈 Regular health screenings as recommended",
            "💧 Stay hydrated and maintain healthy lifestyle"
        ])

        return list(set(recommendations))  # Remove duplicates

    def get_reference_ranges(self) -> Dict[str, Dict]:
        """Get all biomarker reference ranges"""
        return self.biomarker_ranges