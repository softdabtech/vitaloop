import pytest

from app.services.lab_normalization.biomarker_mapping import infer_category, to_canonical_name


@pytest.mark.parametrize(
    ("display_name", "canonical"),
    [
        ("Феритин", "ferritin"),
        ("Ферритин", "ferritin"),
        ("Сироваткове залізо", "iron"),
        ("% transferrin saturation", "transferrin_saturation"),
        ("Гемоглобін", "hemoglobin"),
        ("Reticulocytes (Г/л)", "reticulocytes_absolute"),
        ("С-реактивний білок", "crp"),
        ("Білірубін загальний", "bilirubin_total"),
        ("Креатинін", "creatinine"),
        ("Фолієва кислота", "folate"),
    ],
)
def test_common_en_uk_ru_biomarker_aliases(display_name, canonical):
    assert to_canonical_name(display_name) == canonical


@pytest.mark.parametrize(
    ("display_name", "category"),
    [
        ("Гемоглобін", "hematology"),
        ("Reticulocytes (Г/л)", "hematology"),
        ("Феритин", "nutrients"),
        ("Білірубін загальний", "liver"),
        ("Креатинін", "kidney"),
        ("С-реактивний білок", "inflammation"),
    ],
)
def test_aliases_infer_clinical_category(display_name, category):
    assert infer_category(display_name) == category
