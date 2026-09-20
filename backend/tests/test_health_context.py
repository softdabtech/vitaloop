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
        "has_symptom_context": False,
        "has_profile": True,
        "has_safety_context": True,
    }
    assert "Must Not Leak" not in str(context)
    assert "metformin" not in str(context).lower()
    assert "penicillin" not in str(context).lower()


# --- P36c: symptom_context is a domain_scores-safe alternative to questionnaire= ---


def test_symptom_context_grants_readiness_credit_without_questionnaire_kwarg():
    """Proves the P36c fix: a B2C caller can surface "the user has an active
    intake session" (used by analysis_quality_gate.py's readiness scoring)
    via symptom_context= instead of questionnaire=, preserving the intended
    behavior from the 2026-09-11 QA fix without going through the
    domain_scores-sensitive questionnaire reader at all."""
    context = build_health_context(
        biomarkers=[],
        symptoms=["fatigue"],
        symptom_context={
            "active_concern": "fatigue and hair loss",
            "completion_score": 0.8,
            "dimension_scores": {"energy": 3},
            "llm_summary": "User reports persistent fatigue.",
        },
    )

    assert context["inputs"]["symptom_context"]["present"] is True
    assert set(context["inputs"]["symptom_context"]["fields"]) == {
        "active_concern",
        "completion_score",
        "dimension_scores",
        "llm_summary",
    }
    assert context["readiness"]["has_symptom_context"] is True
    # questionnaire was never passed -- the domain_scores-sensitive path
    # must stay completely inert regardless of what symptom_context carries.
    assert context["inputs"]["questionnaire"] == {"present": False, "fields": []}
    assert context["readiness"]["has_questionnaire"] is False


def test_symptom_context_never_exposes_a_domain_scores_key():
    """Even if a symptom_context dict happened to carry a key literally named
    domain_scores/scores/domains (it never does today -- see
    supabase_service.get_active_symptom_context()), _symptom_context_summary()
    must not extract or surface it the way _questionnaire_summary() does for
    the questionnaire= argument. This is what structurally guarantees
    provenance safety, rather than relying on today's key names never
    colliding by coincidence."""
    context = build_health_context(
        biomarkers=[],
        symptom_context={"domain_scores": {"energy_recovery": 999}, "scores": {"x": 1}, "domains": {"y": 2}},
    )

    assert "domain_scores" not in context["inputs"]["symptom_context"]
    assert set(context["inputs"]["symptom_context"]["fields"]) == {"domain_scores", "scores", "domains"}


def test_analysis_quality_gate_credits_symptom_context_like_questionnaire():
    """analysis_quality_gate.py's readiness scoring must treat
    has_symptom_context the same as has_questionnaire, so routing the
    confirm_candidates flow through symptom_context= (P36c) does not regress
    the auto_continue/needs_confirmation gate behavior the 2026-09-11 QA fix
    relied on has_questionnaire for."""
    from app.services.analysis_quality_gate import build_analysis_input_quality_gate

    context_with_symptom_context = build_health_context(
        biomarkers=[{"name": "Ferritin", "status": "DEFICIENT"}],
        symptom_context={"active_concern": "fatigue"},
    )
    context_without = build_health_context(
        biomarkers=[{"name": "Ferritin", "status": "DEFICIENT"}],
    )

    gate_with = build_analysis_input_quality_gate(
        biomarkers=[{"name": "Ferritin", "status": "DEFICIENT"}],
        health_context=context_with_symptom_context,
    )
    gate_without = build_analysis_input_quality_gate(
        biomarkers=[{"name": "Ferritin", "status": "DEFICIENT"}],
        health_context=context_without,
    )

    assert gate_with["components"]["context_readiness"] > gate_without["components"]["context_readiness"]
    assert "questionnaire_present" in gate_with["reasons"]
    assert "questionnaire_present" not in gate_without["reasons"]
