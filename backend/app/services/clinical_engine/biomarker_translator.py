"""Biomarker name translation from Ukrainian/Russian to English.

Maps localized biomarker names to their English equivalents for consistent
knowledge base matching and canonical name resolution.
"""

from typing import Dict, Optional

# Ukrainian → English biomarker name mappings
_UKRAINIAN_TO_ENGLISH: Dict[str, str] = {
    # Liver enzymes
    "аланін амінотрансфераза": "alanine aminotransferase",
    "аланінамінотрансфераза": "alanine aminotransferase",
    "алт": "alanine aminotransferase",
    "ала": "alanine aminotransferase",
    "альт": "alanine aminotransferase",
    "аспартат амінотрансфераза": "aspartate aminotransferase",
    "аспартатамінотрансфераза": "aspartate aminotransferase",
    "аст": "aspartate aminotransferase",
    "асп": "aspartate aminotransferase",
    "альст": "aspartate aminotransferase",
    "гамма-глутамат трансфераза": "gamma-glutamyl transferase",
    "гамма-глутамилтрансфераза": "gamma-glutamyl transferase",
    "гглт": "gamma-glutamyl transferase",
    "ггт": "gamma-glutamyl transferase",
    "фосфатаза лужна": "alkaline phosphatase",
    "лужна фосфатаза": "alkaline phosphatase",
    "фосфатаза": "alkaline phosphatase",
    "щелочная фосфатаза": "alkaline phosphatase",
    "алп": "alkaline phosphatase",

    # Bilirubin
    "білірубін загальний": "total bilirubin",
    "білірубін прямий": "direct bilirubin",
    "білірубін непрямий": "indirect bilirubin",
    "билирубин общий": "total bilirubin",
    "билирубин прямой": "direct bilirubin",
    "билирубин непрямой": "indirect bilirubin",

    # Proteins
    "альбумін": "albumin",
    "білок загальний": "total protein",
    "білки загальні": "total protein",
    "загальний білок": "total protein",
    "общий белок": "total protein",
    "альбумин": "albumin",

    # Lipids
    "холестерин": "cholesterol",
    "холестерин загальний": "total cholesterol",
    "холестерин общий": "total cholesterol",
    "ліпопротеїди низької щільності": "low-density lipoprotein",
    "ліпопротеїди низкої щільності": "low-density lipoprotein",
    "холестерин ліпопротеїдів низької щільності": "low-density lipoprotein",
    "холестерин ліпопротеїдів низкої щільності": "low-density lipoprotein",
    "ldl холестерин": "low-density lipoprotein",
    "ldl": "low-density lipoprotein",
    "ліпопротеїди високої щільності": "high-density lipoprotein",
    "холестерин ліпопротеїдів високої щільності": "high-density lipoprotein",
    "hdl холестерин": "high-density lipoprotein",
    "hdl": "high-density lipoprotein",
    "тригліцериди": "triglycerides",
    "триглицериды": "triglycerides",
    "коефіцієнт атерогенності": "atherogenic index",
    "индекс атерогенности": "atherogenic index",

    # Glucose
    "глюкоза": "glucose",
    "глюкоза в крові": "glucose",
    "глюкоза в плазмі": "glucose",
    "глюкоза натще": "fasting glucose",
    "глюкоза хаотична": "random glucose",

    # Thyroid
    "тиреотропний гормон": "thyroid stimulating hormone",
    "тиреотропний гормон (тш)": "thyroid stimulating hormone",
    "тиреотропін": "thyroid stimulating hormone",
    "тш": "thyroid stimulating hormone",
    "тиреоидный стимулирующий гормон": "thyroid stimulating hormone",
    "св. т4": "free thyroxine",
    "вільний т4": "free thyroxine",
    "т4 вільний": "free thyroxine",
    "т4 (тироксин)": "thyroxine",
    "т3 вільний": "free triiodothyronine",
    "вільний т3": "free triiodothyronine",
    "антитіла до тпо": "anti-tpo",
    "антитела к пероксидазе щитовидной железы": "anti-tpo",

    # Iron metabolism
    "залізо": "iron",
    "железо": "iron",
    "залізо сироватки": "serum iron",
    "залізо крові": "serum iron",
    "трансфериїн": "transferrin",
    "трансферрин": "transferrin",
    "насичення трансфериїну": "transferrin saturation",
    "насыщение трансферрина": "transferrin saturation",
    "феритин": "ferritin",

    # Kidney function
    "креатинін": "creatinine",
    "креатинин": "creatinine",
    "сечевина": "urea",
    "мочевина": "urea",
    "сечева кислота": "uric acid",
    "мочевая кислота": "uric acid",

    # Calcium/Phosphorus
    "кальцій": "calcium",
    "кальций": "calcium",
    "фосфор": "phosphorus",
    "магній": "magnesium",
    "магний": "magnesium",

    # Inflammation markers
    "c-реактивний білок": "c-reactive protein",
    "с-реактивный белок": "c-reactive protein",
    "c-реактивный белок": "c-reactive protein",
    "crp": "c-reactive protein",
    "срб": "c-reactive protein",
    "високочутливий с-реактивний білок": "high-sensitivity c-reactive protein",
    "высокочувствительный с-реактивный белок": "high-sensitivity c-reactive protein",
    "hs-crp": "high-sensitivity c-reactive protein",
    "г-сп": "high-sensitivity c-reactive protein",

    # Blood cells
    "еритроцити": "red blood cells",
    "эритроциты": "red blood cells",
    "гемоглобін": "hemoglobin",
    "гемоглобин": "hemoglobin",
    "гематокрит": "hematocrit",
    "гематокрит": "hematocrit",
    "лейкоцити": "white blood cells",
    "лейкоциты": "white blood cells",
    "тромбоцити": "platelets",
    "тромбоциты": "platelets",
    "лімфоцити": "lymphocytes",
    "лимфоциты": "lymphocytes",
    "нейтрофіли": "neutrophils",
    "нейтрофилы": "neutrophils",
    "еозинофіли": "eosinophils",
    "эозинофилы": "eosinophils",
    "базофіли": "basophils",
    "базофилы": "basophils",
    "моноцити": "monocytes",
    "моноциты": "monocytes",

    # Vitamins
    "вітамін d": "vitamin d",
    "витамин d": "vitamin d",
    "вітамін b12": "vitamin b12",
    "витамин b12": "vitamin b12",
    "цианокобаламін": "cyanocobalamin",
    "ціанокобаламін": "cyanocobalamin",
    "фолієва кислота": "folate",
    "фолиевая кислота": "folate",

    # Electrolytes
    "натрій": "sodium",
    "натрий": "sodium",
    "калій": "potassium",
    "калий": "potassium",
    "хлор": "chloride",
    "хлорид": "chloride",
    "бікарбонат": "bicarbonate",
    "бикарбонат": "bicarbonate",

    # Hormones
    "кортизол": "cortisol",
    "прогестерон": "progesterone",
    "тестостерон": "testosterone",
    "естрадіол": "estradiol",
    "эстрадиол": "estradiol",
    "пролактин": "prolactin",
    "лютеїнізуючий гормон": "luteinizing hormone",
    "люпинизирующий гормон": "luteinizing hormone",
    "фолікулостимулюючий гормон": "follicle-stimulating hormone",
    "фолликулостимулирующий гормон": "follicle-stimulating hormone",

    # Other common markers
    "альфа-амілаза": "alpha-amylase",
    "альфа-амилаза": "alpha-amylase",
    "ліпаза": "lipase",
    "липаза": "lipase",
    "глютамат дегідрогеназа": "glutamate dehydrogenase",
    "глутамат дегидрогеназа": "glutamate dehydrogenase",
    "лактатдегідрогеназа": "lactate dehydrogenase",
    "лактатдегидрогеназа": "lactate dehydrogenase",
    "креатинкіназа": "creatine kinase",
    "креатинкиназа": "creatine kinase",
}

# Russian → English biomarker name mappings (superset of Ukrainian variants)
_RUSSIAN_TO_ENGLISH: Dict[str, str] = {
    # All Ukrainian mappings in Russian equivalents
    "аланинаминотрансфераза": "alanine aminotransferase",
    "асспартатаминотрансфераза": "aspartate aminotransferase",
    "гамма-глутамилтрансфераза": "gamma-glutamyl transferase",
    "щелочная фосфатаза": "alkaline phosphatase",
    "общий белок": "total protein",
    "общий холестерин": "total cholesterol",
    "холестерин лпнп": "low-density lipoprotein",
    "холестерин лпвп": "high-density lipoprotein",
    "эритроциты": "red blood cells",
    "гемоглобин": "hemoglobin",
    "лейкоциты": "white blood cells",
    "тромбоциты": "platelets",
    "мочевая кислота": "uric acid",
    "креатинин": "creatinine",
    # ... extends with Russian-specific variants
}

# Combined mapping (Ukrainian takes precedence)
_BIOMARKER_TRANSLATIONS = {**_RUSSIAN_TO_ENGLISH, **_UKRAINIAN_TO_ENGLISH}


def translate_biomarker_name(name: str, prefer_language: str = "en") -> str:
    """Translate biomarker name from Ukrainian/Russian to English.

    Args:
        name: Biomarker name (potentially in Ukrainian/Russian)
        prefer_language: Target language ('en' for English)

    Returns:
        English biomarker name if found in translation table, otherwise original name
    """
    if not name:
        return name

    # Normalize: lowercase, strip whitespace, remove extra spaces
    normalized = name.strip().lower()
    normalized = " ".join(normalized.split())  # collapse multiple spaces

    # Try exact match first
    if normalized in _BIOMARKER_TRANSLATIONS:
        return _BIOMARKER_TRANSLATIONS[normalized]

    # Try partial match: if the name contains a known pattern, use it
    for pattern, translation in _BIOMARKER_TRANSLATIONS.items():
        if pattern in normalized:
            return translation

    # No translation found, return original
    return name


def is_localized_name(name: str) -> bool:
    """Check if biomarker name appears to be in Ukrainian/Russian.

    Args:
        name: Biomarker name to check

    Returns:
        True if name contains Cyrillic characters (Ukrainian/Russian)
    """
    if not name:
        return False
    # Check for Cyrillic Unicode range
    return any(0x0400 <= ord(char) <= 0x04FF for char in name)


def get_supported_languages() -> list:
    """Return list of supported source languages."""
    return ["uk", "ru", "en"]  # Ukrainian, Russian, English


def translate_biomarkers_in_panel(
    raw_biomarkers: list,
    detect_language: bool = True,
) -> list:
    """Translate all biomarker names in a panel to English.

    Args:
        raw_biomarkers: List of biomarker dicts with 'name' field
        detect_language: If True, auto-detect and translate; if False, pass through

    Returns:
        List with translated biomarker names
    """
    if not raw_biomarkers:
        return raw_biomarkers

    result = []
    for bm in raw_biomarkers:
        bm_copy = dict(bm)  # Don't modify original
        if isinstance(bm_copy, dict) and "name" in bm_copy:
            name = bm_copy["name"]
            if detect_language and is_localized_name(name):
                bm_copy["name"] = translate_biomarker_name(name)
                bm_copy["original_name"] = name  # Preserve original for reference
            result.append(bm_copy)
        else:
            result.append(bm_copy)
    return result
