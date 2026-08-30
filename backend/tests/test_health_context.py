from app.services.health_context import build_health_context


def test_build_health_context_unifies_labs_symptoms_profile_and_questionnaire():
    context = build_health_context(
        biomarkers=[
            {"name": "Ferritin", "canonical_name": "canonical_ferritin", "status": "DEFICIENT", "category": "minerals"},
            {"name": "LDL", "canonical_name": "canonical_ldl", "status": "ELEVATED", "category": "lipids"},
            {"name": "HDL", "canonical_name": "canonical_hdl", "status": "OPTIMAL", "category": "lipids"},
        ],
        symptoms=["Fatigue", " brain fog "],
        questionnaire={"domain_scores": {"sleep": 42}, "completed": True},
        user_profile={
            "age": 37,
            "sex": "female",
            "height_cm": 170,
            "weight_kg": 68,
            "pregnancy_status": "pregnant",
            "current_medications": ["metformin"],
            "allergies": "penicillin",
            "full_name": "Must Not Leak",
        },
        source_metadata={"source": "b2b_json", "partner_id": "partner-1", "api_version": "v1"},
        locale="uk",
    )

    assert context["version"] == "health_context_v1"
    assert context["locale"] == "uk"
    assert context["inputs"]["biomarkers"]["total"] == 3
    assert context["inputs"]["biomarkers"]["abnormal_categories"] == {"minerals": 1, "lipids": 1}
    assert context["inputs"]["symptoms"]["items"] == ["fatigue", "brain fog"]
    assert context["inputs"]["questionnaire"]["domain_scores"] == {"sleep": 42}
    assert context["inputs"]["profile"]["person_avatar"]["age_band"] == "30_39"
    assert context["inputs"]["profile"]["safety_context"]["has_current_medications"] is True
    assert context["source"]["partner_present"] is True
    assert context["readiness"] == {
        "has_biomarkers": True,
        "has_symptoms": True,
        "has_questionnaire": True,
        "has_profile": True,
        "has_safety_context": True,
    }
    assert "Must Not Leak" not in str(context)
    assert "metformin" not in str(context).lower()
    assert "penicillin" not in str(context).lower()
