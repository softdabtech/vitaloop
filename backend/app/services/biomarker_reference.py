"""
Biomarker Reference Database

Centralized database of lab test reference ranges with multi-unit support.
Source: LabCorp, Mayo Clinic, and getbased standards.

Data structure:
- display_name: User-friendly biomarker name
- category: Group (Blood, Metabolism, Lipids, etc.)
- units: Dict mapping unit string → reference ranges
- priority: Sort order for dropdown (1=top priority, 5=lower)
- notes: Special instructions or gender-specific notes
- conversion_factor: To convert from default unit
"""

from typing import Any, Dict, List, Optional, Tuple
from decimal import Decimal, ROUND_HALF_UP


BIOMARKER_DATABASE = {
    # === BLOOD COUNT MARKERS ===
    "hemoglobin": {
        "display_name": "Hemoglobin",
        "category": "Blood Count",
        "units": {
            "g/dL": {
                "min": 12.0,
                "max": 17.5,
                "optimal_range": [14.0, 16.0],
                "note": "Female: 12-17.5. Male: 13.5-17.5"
            },
            "g/L": {
                "min": 120,
                "max": 175,
                "optimal_range": [140, 160],
                "conversion_from_gdl": 10
            }
        },
        "priority": 1,
        "source": "LabCorp"
    },
    "hematocrit": {
        "display_name": "Hematocrit",
        "category": "Blood Count",
        "units": {
            "%": {
                "min": 36.0,
                "max": 52.0,
                "optimal_range": [40.0, 50.0],
                "note": "Female: 36-46%. Male: 41-52%"
            },
            "L/L": {
                "min": 0.36,
                "max": 0.52,
                "optimal_range": [0.40, 0.50],
                "conversion_from_percent": 0.01
            }
        },
        "priority": 2,
        "source": "LabCorp"
    },
    "rbc": {
        "display_name": "Red Blood Cells (RBC)",
        "category": "Blood Count",
        "units": {
            "x10^6/µL": {
                "min": 3.8,
                "max": 5.5,
                "optimal_range": [4.2, 5.2],
                "note": "Female: 3.8-5.1. Male: 4.3-5.5"
            },
            "x10^12/L": {
                "min": 3.8,
                "max": 5.5,
                "optimal_range": [4.2, 5.2],
                "conversion_from_million_ul": 1.0
            }
        },
        "priority": 2,
        "source": "LabCorp"
    },
    "wbc": {
        "display_name": "White Blood Cells (WBC)",
        "category": "Blood Count",
        "units": {
            "x10^3/µL": {
                "min": 4.5,
                "max": 11.0,
                "optimal_range": [5.0, 10.0],
                "note": "Adult reference range"
            },
            "x10^9/L": {
                "min": 4.5,
                "max": 11.0,
                "optimal_range": [5.0, 10.0],
                "conversion_from_k_ul": 1.0
            }
        },
        "priority": 1,
        "source": "LabCorp"
    },
    "platelets": {
        "display_name": "Platelets",
        "category": "Blood Count",
        "units": {
            "x10^3/µL": {
                "min": 150,
                "max": 400,
                "optimal_range": [200, 350],
                "note": ""
            },
            "x10^9/L": {
                "min": 150,
                "max": 400,
                "optimal_range": [200, 350],
                "conversion_from_k_ul": 1.0
            }
        },
        "priority": 2,
        "source": "LabCorp"
    },

    # === METABOLISM MARKERS ===
    "glucose": {
        "display_name": "Glucose (Fasting)",
        "category": "Metabolism",
        "units": {
            "mg/dL": {
                "min": 70,
                "max": 99,
                "optimal_range": [80, 95],
                "note": "Fasting (no food 8+ hours)"
            },
            "mmol/L": {
                "min": 3.9,
                "max": 5.5,
                "optimal_range": [4.4, 5.3],
                "conversion_from_mgdl": 0.0556
            }
        },
        "priority": 1,
        "source": "Mayo Clinic"
    },
    "glucose_random": {
        "display_name": "Glucose (Random)",
        "category": "Metabolism",
        "units": {
            "mg/dL": {
                "min": 70,
                "max": 140,
                "optimal_range": [80, 120],
                "note": "Can be taken at any time"
            },
            "mmol/L": {
                "min": 3.9,
                "max": 7.8,
                "optimal_range": [4.4, 6.7],
                "conversion_from_mgdl": 0.0556
            }
        },
        "priority": 3,
        "source": "Mayo Clinic"
    },
    "creatinine": {
        "display_name": "Creatinine",
        "category": "Kidney Function",
        "units": {
            "mg/dL": {
                "min": 0.6,
                "max": 1.2,
                "optimal_range": [0.7, 1.0],
                "note": "Female: 0.6-1.1. Male: 0.7-1.3"
            },
            "µmol/L": {
                "min": 53,
                "max": 106,
                "optimal_range": [62, 88],
                "conversion_from_mgdl": 88.4
            }
        },
        "priority": 2,
        "source": "LabCorp"
    },
    "bun": {
        "display_name": "Blood Urea Nitrogen (BUN)",
        "category": "Kidney Function",
        "units": {
            "mg/dL": {
                "min": 7,
                "max": 20,
                "optimal_range": [9, 18],
                "note": "Adult range"
            },
            "mmol/L": {
                "min": 2.5,
                "max": 7.1,
                "optimal_range": [3.2, 6.4],
                "conversion_from_mgdl": 0.357
            }
        },
        "priority": 3,
        "source": "LabCorp"
    },

    # === LIPID MARKERS ===
    "cholesterol_total": {
        "display_name": "Total Cholesterol",
        "category": "Lipids",
        "units": {
            "mg/dL": {
                "min": 0,
                "max": 199,
                "optimal_range": [0, 199],
                "note": "Desirable: <200 mg/dL"
            },
            "mmol/L": {
                "min": 0,
                "max": 5.17,
                "optimal_range": [0, 5.17],
                "conversion_from_mgdl": 0.0259
            }
        },
        "priority": 1,
        "source": "Mayo Clinic"
    },
    "ldl": {
        "display_name": "LDL Cholesterol",
        "category": "Lipids",
        "units": {
            "mg/dL": {
                "min": 0,
                "max": 99,
                "optimal_range": [0, 99],
                "note": "Optimal: <100 mg/dL"
            },
            "mmol/L": {
                "min": 0,
                "max": 2.59,
                "optimal_range": [0, 2.59],
                "conversion_from_mgdl": 0.0259
            }
        },
        "priority": 1,
        "source": "Mayo Clinic"
    },
    "hdl": {
        "display_name": "HDL Cholesterol",
        "category": "Lipids",
        "units": {
            "mg/dL": {
                "min": 40,
                "max": 1000,
                "optimal_range": [60, 1000],
                "note": "Higher is better. >60 is protective"
            },
            "mmol/L": {
                "min": 1.04,
                "max": 25.9,
                "optimal_range": [1.55, 25.9],
                "conversion_from_mgdl": 0.0259
            }
        },
        "priority": 1,
        "source": "Mayo Clinic"
    },
    "triglycerides": {
        "display_name": "Triglycerides",
        "category": "Lipids",
        "units": {
            "mg/dL": {
                "min": 0,
                "max": 149,
                "optimal_range": [0, 149],
                "note": "Fasting. Normal: <150 mg/dL"
            },
            "mmol/L": {
                "min": 0,
                "max": 1.7,
                "optimal_range": [0, 1.7],
                "conversion_from_mgdl": 0.0113
            }
        },
        "priority": 2,
        "source": "Mayo Clinic"
    },

    # === LIVER FUNCTION ===
    "alt": {
        "display_name": "ALT (Alanine Aminotransferase)",
        "category": "Liver Function",
        "units": {
            "U/L": {
                "min": 7,
                "max": 56,
                "optimal_range": [7, 40],
                "note": "Female: 7-35. Male: 10-40"
            },
            "µkat/L": {
                "min": 0.12,
                "max": 0.93,
                "optimal_range": [0.12, 0.67],
                "conversion_from_ul": 0.0167
            }
        },
        "priority": 2,
        "source": "LabCorp"
    },
    "ast": {
        "display_name": "AST (Aspartate Aminotransferase)",
        "category": "Liver Function",
        "units": {
            "U/L": {
                "min": 10,
                "max": 40,
                "optimal_range": [10, 35],
                "note": "Female: 9-32. Male: 11-35"
            },
            "µkat/L": {
                "min": 0.17,
                "max": 0.67,
                "optimal_range": [0.17, 0.58],
                "conversion_from_ul": 0.0167
            }
        },
        "priority": 2,
        "source": "LabCorp"
    },
    "alkaline_phosphatase": {
        "display_name": "Alkaline Phosphatase",
        "category": "Liver Function",
        "units": {
            "U/L": {
                "min": 30,
                "max": 120,
                "optimal_range": [30, 100],
                "note": "Age and sex dependent"
            }
        },
        "priority": 3,
        "source": "LabCorp"
    },
    "bilirubin_total": {
        "display_name": "Bilirubin (Total)",
        "category": "Liver Function",
        "units": {
            "mg/dL": {
                "min": 0.1,
                "max": 1.2,
                "optimal_range": [0.1, 1.0],
                "note": "Newborns have higher ranges"
            },
            "µmol/L": {
                "min": 1.7,
                "max": 20.5,
                "optimal_range": [1.7, 17.1],
                "conversion_from_mgdl": 17.1
            }
        },
        "priority": 3,
        "source": "LabCorp"
    },
    "albumin": {
        "display_name": "Albumin",
        "category": "Liver Function",
        "units": {
            "g/dL": {
                "min": 3.5,
                "max": 5.0,
                "optimal_range": [3.8, 5.0],
                "note": "Key protein indicator"
            },
            "g/L": {
                "min": 35,
                "max": 50,
                "optimal_range": [38, 50],
                "conversion_from_gdl": 10
            }
        },
        "priority": 2,
        "source": "LabCorp"
    },

    # === THYROID FUNCTION ===
    "tsh": {
        "display_name": "TSH (Thyroid Stimulating Hormone)",
        "category": "Thyroid",
        "units": {
            "mIU/L": {
                "min": 0.4,
                "max": 4.0,
                "optimal_range": [0.5, 3.5],
                "note": "Normal range varies by lab"
            }
        },
        "priority": 1,
        "source": "Mayo Clinic"
    },
    "t3_free": {
        "display_name": "Free T3",
        "category": "Thyroid",
        "units": {
            "pg/mL": {
                "min": 2.3,
                "max": 4.2,
                "optimal_range": [2.5, 4.0],
                "note": ""
            },
            "pmol/L": {
                "min": 3.5,
                "max": 6.5,
                "optimal_range": [3.9, 6.1],
                "conversion_from_pgml": 1.536
            }
        },
        "priority": 2,
        "source": "Mayo Clinic"
    },
    "t4_free": {
        "display_name": "Free T4",
        "category": "Thyroid",
        "units": {
            "ng/dL": {
                "min": 0.8,
                "max": 1.8,
                "optimal_range": [0.9, 1.7],
                "note": ""
            },
            "pmol/L": {
                "min": 10.3,
                "max": 23.2,
                "optimal_range": [11.6, 21.9],
                "conversion_from_ngdl": 12.87
            }
        },
        "priority": 2,
        "source": "Mayo Clinic"
    },

    # === MINERALS ===
    "calcium": {
        "display_name": "Calcium",
        "category": "Minerals",
        "units": {
            "mg/dL": {
                "min": 8.5,
                "max": 10.2,
                "optimal_range": [8.9, 10.1],
                "note": ""
            },
            "mmol/L": {
                "min": 2.12,
                "max": 2.55,
                "optimal_range": [2.22, 2.52],
                "conversion_from_mgdl": 0.2495
            }
        },
        "priority": 2,
        "source": "LabCorp"
    },
    "magnesium": {
        "display_name": "Magnesium",
        "category": "Minerals",
        "units": {
            "mg/dL": {
                "min": 1.7,
                "max": 2.2,
                "optimal_range": [1.8, 2.1],
                "note": ""
            },
            "mmol/L": {
                "min": 0.7,
                "max": 0.9,
                "optimal_range": [0.74, 0.87],
                "conversion_from_mgdl": 0.411
            }
        },
        "priority": 3,
        "source": "LabCorp"
    },
    "potassium": {
        "display_name": "Potassium",
        "category": "Minerals",
        "units": {
            "mEq/L": {
                "min": 3.5,
                "max": 5.0,
                "optimal_range": [3.7, 4.8],
                "note": "Narrow safe range"
            },
            "mmol/L": {
                "min": 3.5,
                "max": 5.0,
                "optimal_range": [3.7, 4.8],
                "conversion_from_meql": 1.0
            }
        },
        "priority": 2,
        "source": "LabCorp"
    },
    "sodium": {
        "display_name": "Sodium",
        "category": "Minerals",
        "units": {
            "mEq/L": {
                "min": 136,
                "max": 145,
                "optimal_range": [138, 143],
                "note": ""
            },
            "mmol/L": {
                "min": 136,
                "max": 145,
                "optimal_range": [138, 143],
                "conversion_from_meql": 1.0
            }
        },
        "priority": 2,
        "source": "LabCorp"
    },

    # === PROTEIN ===
    "protein_total": {
        "display_name": "Total Protein",
        "category": "Protein",
        "units": {
            "g/dL": {
                "min": 6.0,
                "max": 8.3,
                "optimal_range": [6.5, 8.0],
                "note": ""
            },
            "g/L": {
                "min": 60,
                "max": 83,
                "optimal_range": [65, 80],
                "conversion_from_gdl": 10
            }
        },
        "priority": 3,
        "source": "LabCorp"
    },

    # === INFLAMMATION ===
    "crp": {
        "display_name": "C-Reactive Protein (CRP)",
        "category": "Inflammation",
        "units": {
            "mg/L": {
                "min": 0,
                "max": 3.0,
                "optimal_range": [0, 1.0],
                "note": "Higher indicates inflammation"
            }
        },
        "priority": 3,
        "source": "Mayo Clinic"
    },

    # === ADDITIONAL IMPORTANT MARKERS ===
    "egfr": {
        "display_name": "eGFR (Kidney Function)",
        "category": "Kidney Function",
        "units": {
            "mL/min/1.73m²": {
                "min": 60,
                "max": 1000,
                "optimal_range": [90, 1000],
                "note": "<60 indicates kidney disease"
            }
        },
        "priority": 2,
        "source": "Mayo Clinic"
    },
    "uric_acid": {
        "display_name": "Uric Acid",
        "category": "Metabolism",
        "units": {
            "mg/dL": {
                "min": 3.5,
                "max": 7.2,
                "optimal_range": [3.5, 6.5],
                "note": "Female: 2.6-6.0. Male: 3.5-7.2"
            },
            "µmol/L": {
                "min": 208,
                "max": 428,
                "optimal_range": [208, 387],
                "conversion_from_mgdl": 59.48
            }
        },
        "priority": 2,
        "source": "LabCorp"
    },
    "phosphorus": {
        "display_name": "Phosphorus",
        "category": "Minerals",
        "units": {
            "mg/dL": {
                "min": 2.5,
                "max": 4.5,
                "optimal_range": [2.8, 4.3],
                "note": ""
            },
            "mmol/L": {
                "min": 0.8,
                "max": 1.45,
                "optimal_range": [0.9, 1.39],
                "conversion_from_mgdl": 0.323
            }
        },
        "priority": 3,
        "source": "LabCorp"
    },
    "chloride": {
        "display_name": "Chloride",
        "category": "Minerals",
        "units": {
            "mEq/L": {
                "min": 98,
                "max": 107,
                "optimal_range": [101, 105],
                "note": ""
            },
            "mmol/L": {
                "min": 98,
                "max": 107,
                "optimal_range": [101, 105],
                "conversion_from_meql": 1.0
            }
        },
        "priority": 3,
        "source": "LabCorp"
    },
    "co2": {
        "display_name": "CO2 (Bicarbonate)",
        "category": "Minerals",
        "units": {
            "mEq/L": {
                "min": 23,
                "max": 29,
                "optimal_range": [24, 28],
                "note": ""
            },
            "mmol/L": {
                "min": 23,
                "max": 29,
                "optimal_range": [24, 28],
                "conversion_from_meql": 1.0
            }
        },
        "priority": 3,
        "source": "LabCorp"
    },
    "hemoglobin_a1c": {
        "display_name": "Hemoglobin A1C",
        "category": "Metabolism",
        "units": {
            "%": {
                "min": 0,
                "max": 5.6,
                "optimal_range": [0, 5.6],
                "note": "Diabetes: >6.5%. Prediabetes: 5.7-6.4%"
            },
            "mmol/mol": {
                "min": 0,
                "max": 38,
                "optimal_range": [0, 38],
                "conversion_from_percent": 10.929
            }
        },
        "priority": 1,
        "source": "Mayo Clinic"
    },
    "iron": {
        "display_name": "Iron (Serum)",
        "category": "Minerals",
        "units": {
            "µg/dL": {
                "min": 60,
                "max": 170,
                "optimal_range": [80, 150],
                "note": "Female: 60-170. Male: 75-175"
            },
            "µmol/L": {
                "min": 10.7,
                "max": 30.4,
                "optimal_range": [14.3, 26.8],
                "conversion_from_ugdl": 0.1791
            }
        },
        "priority": 2,
        "source": "LabCorp"
    },
    "ferritin": {
        "display_name": "Ferritin",
        "category": "Minerals",
        "units": {
            "ng/mL": {
                "min": 30,
                "max": 400,
                "optimal_range": [50, 200],
                "note": "Female: 30-400. Male: 30-400"
            },
            "µg/L": {
                "min": 30,
                "max": 400,
                "optimal_range": [50, 200],
                "conversion_from_ngml": 1.0
            }
        },
        "priority": 2,
        "source": "LabCorp"
    },
    "vitamin_d": {
        "display_name": "Vitamin D (25-OH)",
        "category": "Vitamins",
        "units": {
            "ng/mL": {
                "min": 20,
                "max": 100,
                "optimal_range": [30, 80],
                "note": "Deficiency: <20. Optimal: 30-80"
            },
            "nmol/L": {
                "min": 50,
                "max": 250,
                "optimal_range": [75, 200],
                "conversion_from_ngml": 2.496
            }
        },
        "priority": 2,
        "source": "Mayo Clinic"
    },
    "b12": {
        "display_name": "Vitamin B12",
        "category": "Vitamins",
        "units": {
            "pg/mL": {
                "min": 200,
                "max": 900,
                "optimal_range": [300, 800],
                "note": "Low: <200. Low-normal: 200-350"
            },
            "pmol/L": {
                "min": 148,
                "max": 665,
                "optimal_range": [221, 590],
                "conversion_from_pgml": 0.7378
            }
        },
        "priority": 2,
        "source": "LabCorp"
    },
    "folate": {
        "display_name": "Folate (Serum)",
        "category": "Vitamins",
        "units": {
            "ng/mL": {
                "min": 5.4,
                "max": 36.0,
                "optimal_range": [8.0, 30.0],
                "note": "Deficiency: <5.4"
            },
            "nmol/L": {
                "min": 12.2,
                "max": 81.6,
                "optimal_range": [18.1, 68.0],
                "conversion_from_ngml": 2.266
            }
        },
        "priority": 2,
        "source": "LabCorp"
    },
}


def get_all_biomarkers() -> List[Dict]:
    """Return list of all available biomarkers for dropdown selection."""
    result = []
    for biomarker_id, data in BIOMARKER_DATABASE.items():
        default_unit = list(data["units"].keys())[0]
        result.append({
            "id": biomarker_id,
            "name": data["display_name"],
            "category": data["category"],
            "default_unit": default_unit,
            "alternative_units": list(data["units"].keys())[1:],
            "priority": data.get("priority", 5),
        })

    # Sort by priority (lower number = higher priority)
    result.sort(key=lambda x: x["priority"])
    return result


def get_biomarker_info(biomarker_id: str) -> Optional[Dict]:
    """Get complete information for a biomarker including all units and ranges."""
    return BIOMARKER_DATABASE.get(biomarker_id)


def validate_biomarker_input(
    biomarker_id: str, value: float, unit: str
) -> Tuple[bool, str]:
    """
    Validate that biomarker value is reasonable for given unit.

    Returns:
        (is_valid, error_message)
    """
    biomarker = BIOMARKER_DATABASE.get(biomarker_id)

    if not biomarker:
        return False, f"Unknown biomarker: {biomarker_id}"

    if value < 0:
        return False, "Value cannot be negative"

    if value > 10000:
        return False, "Value seems unreasonably high"

    if unit not in biomarker["units"]:
        available = ", ".join(biomarker["units"].keys())
        return False, f"Unit {unit} not supported. Available: {available}"

    return True, ""


def convert_unit(
    value: float, biomarker_id: str, from_unit: str, to_unit: str
) -> float:
    """
    Convert biomarker value from one unit to another.

    Args:
        value: The numeric value to convert
        biomarker_id: The biomarker identifier
        from_unit: Source unit (e.g., "mmol/L")
        to_unit: Target unit (e.g., "mg/dL")

    Returns:
        Converted value
    """
    if from_unit == to_unit:
        return value

    biomarker = BIOMARKER_DATABASE.get(biomarker_id)
    if not biomarker:
        raise ValueError(f"Unknown biomarker: {biomarker_id}")

    from_units = biomarker["units"].get(from_unit)
    to_units = biomarker["units"].get(to_unit)

    if not from_units or not to_units:
        raise ValueError(f"Unit conversion not supported for {biomarker_id}")

    # Get conversion factor
    conversion_key = f"conversion_from_{from_unit.lower().replace('/', '').replace('^', '').replace('/', '')}"

    # Alternative: use the conversion factor if available
    if "conversion_from_" + from_unit.lower() in str(to_units):
        factor = to_units.get("conversion_from_" + from_unit.lower())
        if factor:
            return float(Decimal(str(value)) * Decimal(str(factor)))

    # Check reverse conversion
    reverse_key = f"conversion_from_{to_unit.lower().replace('/', '').replace('^', '').replace('/', '')}"
    if reverse_key in str(from_units):
        factor = from_units.get(reverse_key)
        if factor:
            return float(Decimal(str(value)) / Decimal(str(factor)))

    # Fallback: look for any conversion factor in target unit
    for key, val in to_units.items():
        if "conversion_from_" in key:
            # Use this factor but invert it
            return float(Decimal(str(value)) / Decimal(str(val)))

    raise ValueError(f"Cannot convert {from_unit} to {to_unit} for {biomarker_id}")


# ──────────────────────────────────────────────
# KNOWLEDGE-BASE REFERENCE RANGES (Stage 18 foundation, wired in here)
# ──────────────────────────────────────────────
# public.lab_markers.key differs from a handful of BIOMARKER_DATABASE ids —
# only listing the ones that actually differ; everything else maps 1:1
# (e.g. "ferritin" -> "ferritin") and is looked up directly.
_LAB_MARKER_KEY_ALIASES: Dict[str, str] = {
    "t3_free": "free_t3",
    "t4_free": "free_t4",
    "hemoglobin_a1c": "hba1c",
    "cholesterol_total": "total_cholesterol",
}

# Adults only (18+) — this product does not serve minors, so reference_ranges
# is never queried with a pediatric age band. A row with a null min_age/
# max_age is treated as "no bound on that side", not "any age including
# children" — every row is expected to already scope to adult ranges.
_ADULT_MIN_AGE = 18

# lab_markers rarely changes (19 rows today, hand-curated via the knowledge
# governance flow) — caching key -> id for the process lifetime avoids a
# round trip on every manual-entry validation. A new marker added while the
# server is running won't be picked up until restart; acceptable for a
# handful of rows that change through a deliberate admin action, not runtime
# user activity.
_lab_marker_id_cache: Dict[str, str] = {}


async def _resolve_lab_marker_id(lab_marker_key: str) -> Optional[str]:
    if lab_marker_key in _lab_marker_id_cache:
        return _lab_marker_id_cache[lab_marker_key]
    try:
        from app.services import supabase_service as svc

        client = svc._get_supabase()
        resp = await svc._run(
            lambda: client.table("lab_markers").select("id").eq("key", lab_marker_key).limit(1).execute()
        )
        rows = resp.data or []
        if not rows:
            return None
        marker_id = rows[0]["id"]
        _lab_marker_id_cache[lab_marker_key] = marker_id
        return marker_id
    except Exception:
        # Table/row absent, Supabase unreachable, etc. — the caller falls
        # back to BIOMARKER_DATABASE, so this must never raise.
        return None


async def get_kb_reference_range(
    biomarker_id: str, unit: str, *, sex: Optional[str] = None, age: Optional[int] = None
) -> Optional[Dict[str, float]]:
    """Look up an age/sex-aware range from public.reference_ranges (Stage 18
    knowledge base). Returns None whenever no matching row exists yet — the
    table starts empty, so this is a no-op until Step 2 (populating it)
    happens; every caller must keep working with BIOMARKER_DATABASE as the
    fallback in that case, not treat a miss as an error.
    """
    lab_marker_key = _LAB_MARKER_KEY_ALIASES.get(biomarker_id, biomarker_id)
    marker_id = await _resolve_lab_marker_id(lab_marker_key)
    if not marker_id:
        return None

    normalized_sex = str(sex or "").strip().lower()
    if normalized_sex not in ("male", "female"):
        normalized_sex = None
    lookup_age = age if isinstance(age, (int, float)) and age >= _ADULT_MIN_AGE else None

    try:
        from app.services import supabase_service as svc

        client = svc._get_supabase()
        query = (
            client.table("reference_ranges")
            .select("sex,min_age,max_age,unit,low_value,high_value,optimal_low_value,optimal_high_value")
            .eq("lab_marker_id", marker_id)
            .eq("unit", unit)
            .eq("active", True)
        )
        resp = await svc._run(lambda: query.execute())
        rows = resp.data or []
    except Exception:
        return None

    if not rows:
        return None

    def _matches(row: Dict[str, Any]) -> bool:
        row_sex = str(row.get("sex") or "any").strip().lower()
        if row_sex not in ("any",) and normalized_sex and row_sex != normalized_sex:
            return False
        if row_sex not in ("any",) and not normalized_sex:
            # Row is sex-specific but we don't know the user's sex — do not
            # guess which one applies.
            return False
        min_age = row.get("min_age")
        max_age = row.get("max_age")
        if lookup_age is not None:
            if min_age is not None and lookup_age < min_age:
                return False
            if max_age is not None and lookup_age > max_age:
                return False
        elif min_age is not None or max_age is not None:
            # Row is age-scoped but we don't know the user's age — do not
            # guess which band applies.
            return False
        return True

    candidates = [row for row in rows if _matches(row)]
    if not candidates:
        return None

    # Prefer the most specific match: exact sex over "any", then a bounded
    # age band over an unbounded one.
    def _specificity(row: Dict[str, Any]) -> tuple:
        sex_score = 0 if str(row.get("sex") or "any").lower() == "any" else 1
        age_score = int(row.get("min_age") is not None) + int(row.get("max_age") is not None)
        return (sex_score, age_score)

    best = max(candidates, key=_specificity)
    low = best.get("low_value")
    high = best.get("high_value")
    return {
        "min": float(low) if low is not None else 0.0,
        "max": float(high) if high is not None else float("inf"),
        "optimal_min": float(best["optimal_low_value"]) if best.get("optimal_low_value") is not None else (float(low) if low is not None else 0.0),
        "optimal_max": float(best["optimal_high_value"]) if best.get("optimal_high_value") is not None else (float(high) if high is not None else float("inf")),
    }


async def calculate_status(
    biomarker_id: str, value: float, unit: str, *, sex: Optional[str] = None, age: Optional[int] = None
) -> str:
    """
    Calculate biomarker status based on value and reference ranges.

    Prefers an age/sex-matched row from the Stage 18 knowledge base
    (public.reference_ranges) when one exists; falls back to the static
    BIOMARKER_DATABASE range (same as before this change) whenever the KB
    has no matching row — including today, while that table is still being
    populated. sex/age are optional and only ever narrow the KB lookup;
    omitting them (or the KB having nothing yet) reproduces the exact
    pre-existing behavior.

    Returns:
        One of: "OPTIMAL", "BORDERLINE", "DEFICIENT", "ELEVATED"
    """
    kb_range = await get_kb_reference_range(biomarker_id, unit, sex=sex, age=age)
    if kb_range:
        ref_min = kb_range["min"]
        ref_max = kb_range["max"]
        optimal_min = kb_range["optimal_min"]
        optimal_max = kb_range["optimal_max"]
    else:
        biomarker = BIOMARKER_DATABASE.get(biomarker_id)
        if not biomarker:
            return "OPTIMAL"  # Default if unknown

        unit_data = biomarker["units"].get(unit)
        if not unit_data:
            return "OPTIMAL"  # Default if unit not found

        ref_min = unit_data.get("min", 0)
        ref_max = unit_data.get("max", float("inf"))
        optimal_min = unit_data.get("optimal_range", [ref_min, ref_max])[0]
        optimal_max = unit_data.get("optimal_range", [ref_min, ref_max])[1]

    # Check if value is in optimal range
    if optimal_min <= value <= optimal_max:
        return "OPTIMAL"

    # Check if value is in reference range but outside optimal
    if ref_min <= value <= ref_max:
        return "BORDERLINE"

    # Check if value is below reference
    if value < ref_min:
        return "DEFICIENT"

    # Value is above reference
    return "ELEVATED"


def get_conversion_factor(biomarker_id: str, from_unit: str, to_unit: str) -> Optional[float]:
    """Get the conversion factor between two units for a biomarker."""
    biomarker = BIOMARKER_DATABASE.get(biomarker_id)
    if not biomarker:
        return None

    if from_unit == to_unit:
        return 1.0

    to_unit_data = biomarker["units"].get(to_unit)
    if not to_unit_data:
        return None

    # Look for conversion factor
    conversion_key = f"conversion_from_{from_unit.lower().replace('/', '_').replace('^', '').replace(' ', '')}"
    return to_unit_data.get(conversion_key)
