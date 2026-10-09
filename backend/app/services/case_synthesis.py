"""Deterministic, evidence-linked synthesis of one completed analysis.

The analysis pipeline already produces markers, patterns, hypotheses,
contradictions, gaps, actions, and retest plans.  This module does not add a
new clinical inference layer.  It assembles those outputs into the single
nine-section contract used by downstream narrative and UI layers.

Every user-facing statement carries at least one concrete reference to a
biomarker, symptom, or profile field.  Statements that cannot be grounded are
omitted instead of being filled with generic wellness copy.
"""

from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List


CASE_SYNTHESIS_VERSION = "case_synthesis_v1"
UNIFIED_PERSONAL_NARRATIVE_VERSION = "unified_personal_narrative_v1"

CASE_SYNTHESIS_SECTIONS = (
    "main_conclusion",
    "what_was_found",
    "symptom_connections",
    "likely_explanations",
    "contradictions_and_limits",
    "missing_information",
    "actions_now",
    "clinician_discussion",
    "retest_plan",
)

_ATTENTION_STATUSES = {"DEFICIENT", "LOW", "L", "ELEVATED", "HIGH", "H", "BORDERLINE"}
_STABLE_STATUSES = {"OPTIMAL", "NORMAL", "IN_RANGE", "IN RANGE"}
_UNIFIED_SAFETY_RANK = {
    "routine": 0,
    "insufficient_data": 1,
    "medical_review": 2,
    "high": 3,
    "immediate": 4,
}
_UNIFIED_UNCERTAIN_STATUSES = {"UNKNOWN", "UNEVALUATED"}


def _key(value: Any) -> str:
    text = str(value or "").strip().lower().removeprefix("canonical_")
    return re.sub(r"[^a-z0-9]+", "_", text).strip("_")


def _label(marker: Dict[str, Any]) -> str:
    return str(
        marker.get("name")
        or marker.get("display_name")
        or marker.get("source_name")
        or marker.get("canonical_name")
        or "Biomarker"
    ).strip()


def _marker_ref(marker: Dict[str, Any], *, availability: str = "observed") -> Dict[str, Any]:
    label = _label(marker)
    canonical = str(marker.get("canonical_name") or "").strip()
    reference: Dict[str, Any] = {
        "type": "biomarker",
        "id": canonical or _key(label),
        "label": label,
        "availability": availability,
    }
    for field in ("value", "unit", "status", "reference_range"):
        value = marker.get(field)
        if value not in (None, ""):
            reference[field] = value
    return reference


def _missing_marker_ref(marker: Any) -> Dict[str, Any]:
    label = str(marker or "Required biomarker").strip()
    return {
        "type": "biomarker",
        "id": _key(label),
        "label": label,
        "availability": "missing",
    }


def _symptom_ref(symptom: Any) -> Dict[str, Any]:
    if isinstance(symptom, dict):
        label = str(symptom.get("label") or symptom.get("symptom_label") or "Symptom answer").strip()
        concept_id = str(
            symptom.get("concept_id") or symptom.get("symptom_concept_id") or ""
        ).strip()
        choice = str(symptom.get("choice") or "present").strip()
    else:
        label = str(symptom or "").strip()
        concept_id = _key(label)
        choice = "present"
    return {
        "type": "symptom",
        "id": concept_id or _key(label),
        "label": label,
        "availability": "reported" if choice == "present" else choice,
    }


def _profile_ref(field: str, value: Any, *, availability: str) -> Dict[str, Any]:
    reference: Dict[str, Any] = {
        "type": "profile",
        "id": field,
        "label": field.replace("_", " "),
        "availability": availability,
    }
    if availability == "provided":
        reference["value"] = value
    return reference


def _dedupe_refs(references: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    result: List[Dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for reference in references:
        if not isinstance(reference, dict):
            continue
        ref_type = str(reference.get("type") or "")
        ref_id = str(reference.get("id") or "")
        availability = str(reference.get("availability") or "")
        if ref_type not in {"biomarker", "symptom", "profile"} or not ref_id:
            continue
        identity = (ref_type, ref_id, availability)
        if identity in seen:
            continue
        seen.add(identity)
        result.append(reference)
    return result


def _statement(text: Any, references: Iterable[Dict[str, Any]], **fields: Any) -> Dict[str, Any] | None:
    cleaned_text = str(text or "").strip()
    evidence = _dedupe_refs(references)
    if not cleaned_text or not evidence:
        return None
    return {"text": cleaned_text, "evidence": evidence, **fields}


def _marker_index(biomarkers: Iterable[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    index: Dict[str, Dict[str, Any]] = {}
    for marker in biomarkers:
        if not isinstance(marker, dict):
            continue
        for value in (
            marker.get("canonical_name"),
            marker.get("name"),
            marker.get("display_name"),
            marker.get("source_name"),
        ):
            marker_key = _key(value)
            if marker_key:
                index.setdefault(marker_key, marker)
    return index


def _find_marker(value: Any, index: Dict[str, Dict[str, Any]]) -> Dict[str, Any] | None:
    if isinstance(value, dict):
        for candidate in (
            value.get("canonical_name"),
            value.get("name"),
            value.get("display_name"),
            value.get("source_name"),
            value.get("marker"),
        ):
            marker_key = _key(candidate)
            if marker_key in index:
                return index[marker_key]
        if any(value.get(field) not in (None, "") for field in ("value", "status", "unit")):
            return value
        return None

    marker_key = _key(value)
    if marker_key in index:
        return index[marker_key]
    partial_matches: Dict[int, Dict[str, Any]] = {}
    for indexed_key, marker in index.items():
        if marker_key and (marker_key in indexed_key or indexed_key in marker_key):
            partial_matches[id(marker)] = marker
    if len(partial_matches) == 1:
        return next(iter(partial_matches.values()))
    return None


def _marker_refs(values: Iterable[Any], index: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    references: List[Dict[str, Any]] = []
    for value in values:
        marker = _find_marker(value, index)
        if marker:
            references.append(_marker_ref(marker))
    return _dedupe_refs(references)


def _marker_text(marker: Dict[str, Any]) -> str:
    label = _label(marker)
    value = marker.get("value")
    unit = str(marker.get("unit") or "").strip()
    status = str(marker.get("status") or "").strip().upper()
    measured = " ".join(part for part in (str(value) if value not in (None, "") else "", unit) if part)
    detail = measured or "measured"
    return f"{label} is {detail}{f' ({status})' if status else ''}."


def _pattern_refs(pattern: Dict[str, Any], index: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    return _marker_refs(
        [
            *(pattern.get("triggered_biomarkers") or []),
            *(pattern.get("supportive_markers") or []),
            *(pattern.get("normal_context") or []),
        ],
        index,
    )


def _hypothesis_refs(hypothesis: Dict[str, Any], index: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    return _marker_refs(hypothesis.get("supporting_evidence") or [], index)


def _profile_gap_refs(profile: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [
        _profile_ref(field, None, availability="missing")
        for field in ("age", "sex", "height_cm", "weight_kg")
        if profile.get(field) in (None, "", [], {})
    ]


def _source_refs(
    source_id: Any,
    *,
    index: Dict[str, Dict[str, Any]],
    pattern_by_id: Dict[str, Dict[str, Any]],
    hypothesis_by_id: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    marker = _find_marker(source_id, index)
    if marker:
        return [_marker_ref(marker)]
    source_key = str(source_id or "")
    if source_key in pattern_by_id:
        return _pattern_refs(pattern_by_id[source_key], index)
    if source_key in hypothesis_by_id:
        return _hypothesis_refs(hypothesis_by_id[source_key], index)
    return []


def _valid_dicts(value: Any) -> List[Dict[str, Any]]:
    return [item for item in (value if isinstance(value, list) else []) if isinstance(item, dict)]


def _append(target: List[Dict[str, Any]], item: Dict[str, Any] | None) -> None:
    if item is not None:
        target.append(item)


def build_case_synthesis(
    *,
    biomarkers: List[Dict[str, Any]] | None = None,
    symptoms: List[str] | None = None,
    user_profile: Dict[str, Any] | None = None,
    interpreted_report: Dict[str, Any] | None = None,
    clinical_hypotheses: Dict[str, Any] | None = None,
    clinical_contradictions: Dict[str, Any] | None = None,
    evidence_gaps: Dict[str, Any] | None = None,
    action_plan_by_role: Dict[str, Any] | None = None,
    retest_suggestions: List[Dict[str, Any]] | None = None,
    next_best_tests: Dict[str, Any] | None = None,
    safety_result: Dict[str, Any] | None = None,
    symptom_analysis: Dict[str, Any] | None = None,
    locale: str = "en",
) -> Dict[str, Any]:
    """Build the P1 Case Synthesis contract without new clinical inference."""
    marker_rows = _valid_dicts(biomarkers or [])
    profile = user_profile if isinstance(user_profile, dict) else {}
    symptom_rows = [str(item).strip() for item in (symptoms or []) if str(item).strip()]
    index = _marker_index(marker_rows)
    patterns = _valid_dicts((interpreted_report or {}).get("patterns"))
    hypotheses = _valid_dicts((clinical_hypotheses or {}).get("hypotheses"))
    contradictions = _valid_dicts((clinical_contradictions or {}).get("contradictions"))
    gaps = _valid_dicts((evidence_gaps or {}).get("gaps"))
    symptom_analysis = symptom_analysis if isinstance(symptom_analysis, dict) else {}
    symptom_matrix = _valid_dicts(symptom_analysis.get("matrix"))
    symptom_concepts = {
        str(item.get("concept_id")): item
        for item in _valid_dicts(symptom_analysis.get("concepts"))
        if item.get("concept_id")
    }
    pattern_by_id = {
        str(item.get("pattern_id") or item.get("key")): item
        for item in patterns
        if item.get("pattern_id") or item.get("key")
    }
    hypothesis_by_id = {
        str(item.get("hypothesis_id")): item
        for item in hypotheses
        if item.get("hypothesis_id")
    }

    sections: Dict[str, List[Dict[str, Any]]] = {
        section: [] for section in CASE_SYNTHESIS_SECTIONS
    }

    # What was found: marker values first, plus explicitly detected combinations.
    attention_markers = [
        marker for marker in marker_rows
        if str(marker.get("status") or "").strip().upper() in _ATTENTION_STATUSES
    ]
    stable_markers = [
        marker for marker in marker_rows
        if str(marker.get("status") or "").strip().upper() in _STABLE_STATUSES
    ]
    for marker in attention_markers[:8]:
        _append(
            sections["what_was_found"],
            _statement(_marker_text(marker), [_marker_ref(marker)], kind="biomarker_finding"),
        )
    if not attention_markers and stable_markers:
        marker = stable_markers[0]
        _append(
            sections["what_was_found"],
            _statement(
                f"No attention-level marker was identified in this panel; {_marker_text(marker)}",
                [_marker_ref(marker)],
                kind="stable_panel_finding",
            ),
        )
    for pattern in patterns[:5]:
        references = _pattern_refs(pattern, index)
        names = [str(ref.get("label")) for ref in references[:4]]
        if not names:
            continue
        title = pattern.get("pattern_name") or pattern.get("title") or pattern.get("pattern_id")
        _append(
            sections["what_was_found"],
            _statement(
                f"{title} groups the current findings for {', '.join(names)}.",
                references,
                kind="marker_combination",
                pattern_id=pattern.get("pattern_id") or pattern.get("key"),
            ),
        )

    # P2 uses stable concept IDs and reviewed domain links. The legacy text
    # bridge remains only for reports generated without symptom_analysis.
    if symptom_matrix:
        for row in symptom_matrix:
            concept = symptom_concepts.get(str(row.get("symptom_concept_id") or ""), row)
            symptom_reference = _symptom_ref(concept)
            matches = _valid_dicts(row.get("hypotheses"))
            if row.get("choice") == "present" and matches:
                for match in matches[:3]:
                    hypothesis = hypothesis_by_id.get(str(match.get("hypothesis_id") or ""), {})
                    marker_references = _marker_refs(match.get("confirming_marker_ids") or [], index)
                    label = hypothesis.get("label") or match.get("hypothesis_id") or "the related explanation"
                    _append(
                        sections["symptom_connections"],
                        _statement(
                            f"{concept.get('label')} increases the priority of {label} because your answer is relevant to the related biomarker findings; this is supportive context, not proof of cause.",
                            [symptom_reference, *marker_references],
                            relationship="domain_supported",
                            symptom_concept_id=concept.get("concept_id"),
                            hypothesis_id=match.get("hypothesis_id"),
                        ),
                    )
            elif row.get("choice") == "absent" and matches:
                for match in matches[:3]:
                    hypothesis = hypothesis_by_id.get(str(match.get("hypothesis_id") or ""), {})
                    marker_references = _marker_refs(match.get("confirming_marker_ids") or [], index)
                    label = hypothesis.get("label") or match.get("hypothesis_id") or "the related explanation"
                    _append(
                        sections["symptom_connections"],
                        _statement(
                            f"Reported absence of {concept.get('label')} lowers the priority of {label} because this answer weakens the related explanation.",
                            [symptom_reference, *marker_references],
                            relationship="domain_weakened",
                            symptom_concept_id=concept.get("concept_id"),
                            hypothesis_id=match.get("hypothesis_id"),
                        ),
                    )
            elif row.get("choice") == "present":
                _append(
                    sections["symptom_connections"],
                    _statement(
                        f"{concept.get('label')} was reported, but it did not match a current biomarker finding.",
                        [symptom_reference],
                        relationship="unlinked",
                        symptom_concept_id=concept.get("concept_id"),
                    ),
                )
    else:
        linked_symptoms: set[str] = set()
        for pattern in patterns:
            matched = [str(item).strip() for item in (pattern.get("symptom_signal") or []) if str(item).strip()]
            if not matched:
                continue
            marker_references = _pattern_refs(pattern, index)
            symptom_references = [_symptom_ref(item) for item in matched]
            linked_symptoms.update(_key(item) for item in matched)
            title = pattern.get("pattern_name") or pattern.get("title") or "the detected marker pattern"
            marker_names = ", ".join(str(item.get("label")) for item in marker_references[:3])
            suffix = f" alongside {marker_names}" if marker_names else ""
            _append(
                sections["symptom_connections"],
                _statement(
                    f"{', '.join(matched)} overlaps with {title}{suffix}; this is a correlation to review, not proof of cause.",
                    [*symptom_references, *marker_references],
                    pattern_id=pattern.get("pattern_id") or pattern.get("key"),
                ),
            )
        for symptom in symptom_rows:
            if _key(symptom) in linked_symptoms:
                continue
            _append(
                sections["symptom_connections"],
                _statement(
                    f"{symptom} was reported, but the current analysis did not link it to a detected biomarker pattern.",
                    [_symptom_ref(symptom)],
                    relationship="unlinked",
                ),
            )

    # Ranked explanations reuse calibrated hypotheses and always stay non-diagnostic.
    for hypothesis in hypotheses[:5]:
        references = _hypothesis_refs(hypothesis, index)
        if not references:
            pattern = pattern_by_id.get(str(hypothesis.get("hypothesis_id") or ""))
            references = _pattern_refs(pattern, index) if pattern else []
        label = hypothesis.get("label") or hypothesis.get("hypothesis_id") or "This explanation"
        bucket = hypothesis.get("calibrated_confidence") or hypothesis.get("likelihood_bucket") or "uncertain"
        symptom_priority = hypothesis.get("symptom_priority") or {}
        supporting_concept_ids = symptom_priority.get("supporting_concept_ids") or []
        absent_concept_ids = symptom_priority.get("absent_concept_ids") or []
        supporting_concepts = [symptom_concepts[item] for item in supporting_concept_ids if item in symptom_concepts]
        absent_concepts = [symptom_concepts[item] for item in absent_concept_ids if item in symptom_concepts]
        references = [
            *references,
            *[_symptom_ref(item) for item in supporting_concepts],
            *[_symptom_ref(item) for item in absent_concepts],
        ]
        symptom_reason = ""
        if supporting_concepts:
            symptom_reason = (
                " Reported "
                + ", ".join(str(item.get("label")) for item in supporting_concepts)
                + " raises its priority because it is relevant to the related biomarker findings."
            )
        if absent_concepts:
            symptom_reason += (
                " Reported absence of "
                + ", ".join(str(item.get("label")) for item in absent_concepts)
                + " lowers its priority because its absence weakens the related explanation."
            )
        _append(
            sections["likely_explanations"],
            _statement(
                f"{label} is ranked {bucket} from the available evidence and remains an explanation to review rather than a diagnosis.{symptom_reason}",
                references,
                hypothesis_id=hypothesis.get("hypothesis_id"),
                rank=hypothesis.get("rank"),
                confidence=bucket,
                changed_by_symptoms=bool(supporting_concepts or absent_concepts),
                symptom_concept_ids=supporting_concept_ids,
                absent_symptom_concept_ids=absent_concept_ids,
            ),
        )

    # Contradictions and limits preserve the engine's own uncertainty signals.
    for contradiction in contradictions[:8]:
        references = _marker_refs(contradiction.get("markers") or [], index)
        if not references:
            related = contradiction.get("related_hypotheses") or []
            for hypothesis_id in related:
                references.extend(_source_refs(
                    hypothesis_id,
                    index=index,
                    pattern_by_id=pattern_by_id,
                    hypothesis_by_id=hypothesis_by_id,
                ))
        _append(
            sections["contradictions_and_limits"],
            _statement(
                contradiction.get("message") or contradiction.get("reason"),
                references,
                kind="contradiction",
                contradiction_id=contradiction.get("id") or contradiction.get("rule_id"),
            ),
        )
    for hypothesis in hypotheses:
        weakening = hypothesis.get("weakening_evidence") or {}
        contradicting = weakening.get("contradicting_markers") if isinstance(weakening, dict) else []
        references = _marker_refs(contradicting or [], index)
        if references:
            label = hypothesis.get("label") or hypothesis.get("hypothesis_id")
            _append(
                sections["contradictions_and_limits"],
                _statement(
                    f"The current values for {', '.join(str(ref.get('label')) for ref in references)} weaken the {label} explanation.",
                    references,
                    kind="weakening_evidence",
                    hypothesis_id=hypothesis.get("hypothesis_id"),
                ),
            )

    # An evidence gap is also an explicit limit on the conclusion even when
    # no measured marker directly contradicts it. Keep that limit visible in
    # this section as well as in missing_information so callers do not mistake
    # "no contradiction detected" for "no uncertainty present".
    for gap in gaps[:8]:
        missing_marker = gap.get("missing_marker")
        if missing_marker:
            references = [_missing_marker_ref(missing_marker)]
            domain = str(gap.get("domain") or "current").replace("_", " ")
            text = (
                f"Missing {missing_marker} limits confidence in the {domain} interpretation."
            )
        else:
            references = _profile_gap_refs(profile) if str(gap.get("domain")) == "data_quality" else []
            text = gap.get("reason") or gap.get("suggested_next_step")
        _append(
            sections["contradictions_and_limits"],
            _statement(
                text,
                references,
                kind="evidence_limit",
                priority=gap.get("priority"),
                domain=gap.get("domain"),
            ),
        )

    # Missing information names the absent marker/profile context directly.
    for gap in gaps[:12]:
        missing_marker = gap.get("missing_marker")
        if missing_marker:
            references = [_missing_marker_ref(missing_marker)]
            text = gap.get("suggested_next_step") or gap.get("reason") or "Additional marker context is needed."
            text = f"{missing_marker}: {text}"
        else:
            references = _profile_gap_refs(profile) if str(gap.get("domain")) == "data_quality" else []
            if not references:
                continue
            text = gap.get("suggested_next_step") or gap.get("reason") or "Profile context is incomplete."
        _append(
            sections["missing_information"],
            _statement(
                text,
                references,
                priority=gap.get("priority"),
                domain=gap.get("domain"),
            ),
        )

    # Immediate actions come first from pattern-scoped steps, then from role routing.
    for pattern in patterns[:3]:
        pattern_references = _pattern_refs(pattern, index)
        for action in _valid_dicts(pattern.get("next_best_steps"))[:3]:
            references = pattern_references
            if action.get("key") == "complete_profile":
                references = _profile_gap_refs(profile) or pattern_references
            _append(
                sections["actions_now"],
                _statement(
                    action.get("text"),
                    references,
                    priority=action.get("priority"),
                    timeframe=action.get("timeframe"),
                    pattern_id=pattern.get("pattern_id") or pattern.get("key"),
                ),
            )
    buckets = (action_plan_by_role or {}).get("buckets")
    buckets = buckets if isinstance(buckets, dict) else {}
    for bucket in ("urgent", "self"):
        for action in _valid_dicts(buckets.get(bucket))[:3]:
            references = _source_refs(
                action.get("source_id"),
                index=index,
                pattern_by_id=pattern_by_id,
                hypothesis_by_id=hypothesis_by_id,
            )
            text = action.get("reason") or action.get("title")
            _append(
                sections["actions_now"],
                _statement(
                    text,
                    references,
                    role=bucket,
                    priority="urgent" if bucket == "urgent" else "routine",
                ),
            )
    if (safety_result or {}).get("urgent_review_required"):
        references: List[Dict[str, Any]] = [_marker_ref(item) for item in attention_markers[:3]]
        references.extend(_symptom_ref(item) for item in symptom_rows[:3])
        _append(
            sections["actions_now"],
            _statement(
                (safety_result or {}).get("prominent_user_warning")
                or "The current safety signal requires prompt clinical review.",
                references,
                role="urgent",
                priority="urgent",
            ),
        )
    if marker_rows and not sections["actions_now"]:
        marker = attention_markers[0] if attention_markers else marker_rows[0]
        if attention_markers:
            text = f"Review {_marker_text(marker)} at the next clinically appropriate follow-up."
            priority = "medium"
            timeframe = "next_clinical_review"
        else:
            text = f"Keep {_marker_text(marker)} as a baseline and compare it with the next clinically appropriate repeat panel."
            priority = "routine"
            timeframe = "next_routine_review"
        _append(
            sections["actions_now"],
            _statement(
                text,
                [_marker_ref(marker)],
                role="self",
                priority=priority,
                timeframe=timeframe,
            ),
        )

    # Clinician discussion uses pattern-authored questions and routed doctor items.
    for pattern in patterns[:3]:
        references = _pattern_refs(pattern, index)
        for question in (pattern.get("doctor_questions") or [])[:3]:
            _append(
                sections["clinician_discussion"],
                _statement(
                    question,
                    references,
                    pattern_id=pattern.get("pattern_id") or pattern.get("key"),
                ),
            )
    for bucket in ("urgent", "doctor", "practitioner"):
        for action in _valid_dicts(buckets.get(bucket))[:3]:
            references = _source_refs(
                action.get("source_id"),
                index=index,
                pattern_by_id=pattern_by_id,
                hypothesis_by_id=hypothesis_by_id,
            )
            _append(
                sections["clinician_discussion"],
                _statement(
                    action.get("reason") or action.get("title"),
                    references,
                    role=bucket,
                ),
            )

    # Retest plan keeps the existing concrete timing. Missing next-best tests
    # are added only with an explicit next-review timing, never as an undated tip.
    seen_retests: set[str] = set()
    for retest in _valid_dicts(retest_suggestions or []):
        marker_name = retest.get("marker")
        marker_key = _key(marker_name)
        if not marker_key or marker_key in seen_retests:
            continue
        seen_retests.add(marker_key)
        marker = _find_marker(marker_name, index)
        references = [_marker_ref(marker)] if marker else [_missing_marker_ref(marker_name)]
        timing = retest.get("timing") or "at the next clinically appropriate review"
        reason = str(retest.get("reason") or "Track whether this finding changes.").strip()
        _append(
            sections["retest_plan"],
            _statement(
                f"Recheck {marker_name} {timing}: {reason}",
                references,
                marker=marker_name,
                timing=timing,
                priority=retest.get("priority"),
            ),
        )
    for retest in _valid_dicts((next_best_tests or {}).get("recommended_tests")):
        marker_name = retest.get("marker")
        marker_key = _key(marker_name)
        if not marker_key or marker_key in seen_retests:
            continue
        seen_retests.add(marker_key)
        references = [_missing_marker_ref(marker_name)]
        timing = "at the next clinically appropriate lab review"
        _append(
            sections["retest_plan"],
            _statement(
                f"Add {marker_name} {timing}: {retest.get('reason') or 'This would reduce current uncertainty.'}",
                references,
                marker=marker_name,
                timing=timing,
                priority=retest.get("priority"),
            ),
        )

    profile_references = [
        _profile_ref(field, profile.get(field), availability="provided")
        for field in ("age", "sex")
        if profile.get(field) not in (None, "", [], {})
    ]
    if profile_references:
        profile_details = "; ".join(
            f"{reference['label']}: {reference['value']}"
            for reference in profile_references
        )
        _append(
            sections["what_was_found"],
            _statement(
                f"Reference and safety context for this synthesis uses the recorded profile ({profile_details}).",
                profile_references,
                kind="profile_context",
            ),
        )

    # Main conclusion is a strict 2-4 item digest of the grounded sections.
    conclusion_candidates = [
        *(sections["likely_explanations"][:1]),
        *(sections["what_was_found"][:1]),
        *(sections["symptom_connections"][:1]),
        *(sections["contradictions_and_limits"][:1]),
        *(sections["missing_information"][:1]),
        *(sections["actions_now"][:1]),
    ]
    seen_text: set[str] = set()
    for item in conclusion_candidates:
        text_key = str(item.get("text") or "").casefold()
        if not text_key or text_key in seen_text:
            continue
        seen_text.add(text_key)
        sections["main_conclusion"].append(item)
        if len(sections["main_conclusion"]) == 4:
            break
    if marker_rows and len(sections["main_conclusion"]) < 2:
        first = marker_rows[0]
        _append(
            sections["main_conclusion"],
            _statement(
                f"This synthesis is limited to the {len(marker_rows)} measured biomarker(s) in the current panel, including {_label(first)}.",
                [_marker_ref(first)],
                kind="scope_limit",
            ),
        )

    all_statements = [item for section in CASE_SYNTHESIS_SECTIONS for item in sections[section]]
    ungrounded = [item for item in all_statements if not item.get("evidence")]
    status = "complete" if marker_rows and len(sections["main_conclusion"]) >= 2 else "insufficient_data"

    return {
        "version": CASE_SYNTHESIS_VERSION,
        "locale": str(locale or "en").lower(),
        "status": status,
        **sections,
        "symptom_impact": {
            "changed": bool((symptom_analysis.get("conclusion_change") or {}).get("changed")),
            "reason": (symptom_analysis.get("conclusion_change") or {}).get("reason"),
            "explanations": (symptom_analysis.get("conclusion_change") or {}).get("explanations") or [],
            "concept_ids": sorted(symptom_concepts),
            "matrix_version": symptom_analysis.get("matrix_version"),
            "source_completed_at": (symptom_analysis.get("source") or {}).get("completed_at"),
        },
        "grounding": {
            "policy": "every_statement_references_biomarker_symptom_or_profile",
            "statement_count": len(all_statements),
            "ungrounded_statement_count": len(ungrounded),
            "all_statements_grounded": not ungrounded,
            "allowed_evidence_types": ["biomarker", "symptom", "profile"],
        },
    }


def _unified_source_version(source: Dict[str, Any] | None, fallback: Any = None) -> Any:
    value = source.get("version") if isinstance(source, dict) else None
    return value if value not in (None, "") else fallback


def _unified_refs(item: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [reference for reference in _dedupe_refs(item.get("evidence") or [])]


def _unified_statement(
    item: Dict[str, Any],
    *,
    source_type: str,
    source_version: Any,
    safety_level: Any = None,
    confidence_or_limit: Any = None,
) -> Dict[str, Any]:
    evidence = _unified_refs(item)
    related_markers = [
        reference.get("id")
        for reference in evidence
        if reference.get("type") == "biomarker"
    ]
    related_symptoms = [
        reference.get("id")
        for reference in evidence
        if reference.get("type") == "symptom"
    ]
    return {
        "text": str(item.get("text") or "").strip(),
        "evidence": evidence,
        "source_type": source_type,
        "source_version": source_version,
        "confidence_or_limit": confidence_or_limit,
        "related_markers": related_markers,
        "related_symptoms": related_symptoms,
        "safety_level": safety_level,
    }


def _unified_safe_finding(item: Dict[str, Any]) -> bool:
    evidence = _unified_refs(item)
    return not any(
        reference.get("type") == "biomarker"
        and str(reference.get("status") or "").upper() in _UNIFIED_UNCERTAIN_STATUSES
        for reference in evidence
    )


def _unified_safety_level(safety_result: Dict[str, Any] | None) -> str:
    safety = safety_result if isinstance(safety_result, dict) else {}
    level = str(safety.get("safety_level") or safety.get("risk_level") or "routine").strip().lower()
    return level if level in _UNIFIED_SAFETY_RANK else "routine"


def _unified_safety_evidence(
    case_synthesis: Dict[str, Any],
    safety_result: Dict[str, Any],
) -> List[Dict[str, Any]]:
    candidates = [
        *(case_synthesis.get("what_was_found") or []),
        *(case_synthesis.get("actions_now") or []),
        *(case_synthesis.get("clinician_discussion") or []),
    ]
    for item in candidates:
        if isinstance(item, dict) and _unified_refs(item):
            return _unified_refs(item)
    return []


def _unified_trend_statement(
    trend: Dict[str, Any],
    *,
    source_version: Any,
) -> Dict[str, Any] | None:
    marker_id = str(trend.get("canonical_name") or trend.get("name") or "").strip()
    previous_date = trend.get("previous_measured_at")
    current_date = trend.get("current_measured_at")
    if not marker_id or not previous_date or not current_date:
        return None
    unit = trend.get("unit")
    evidence = [
        {
            "type": "biomarker",
            "id": marker_id,
            "label": trend.get("name") or marker_id,
            "availability": "observed",
            "value": trend.get("current_value"),
            "unit": unit,
            "measured_at": current_date,
            "previous_value": trend.get("previous_value"),
            "previous_measured_at": previous_date,
        }
    ]
    direction = str(trend.get("direction") or "stable").strip()
    return {
        "text": (
            f"{trend.get('name') or marker_id} changed {direction} by "
            f"{trend.get('percent_change')}% between the comparable dated measurements."
        ),
        "evidence": evidence,
        "source_type": "trend_analysis",
        "source_version": source_version,
        "confidence_or_limit": None,
        "related_markers": [marker_id],
        "related_symptoms": [],
        "safety_level": None,
    }


def build_unified_personal_narrative(
    *,
    case_synthesis: Dict[str, Any] | None = None,
    safety_result: Dict[str, Any] | None = None,
    doctor_escalation_precision: Dict[str, Any] | None = None,
    symptom_snapshot: Dict[str, Any] | None = None,
    health_context: Dict[str, Any] | None = None,
    trend_analysis: Dict[str, Any] | None = None,
    progress_intelligence: Dict[str, Any] | None = None,
    evidence_gaps: Dict[str, Any] | None = None,
    confidence_calibration: Dict[str, Any] | None = None,
    next_best_tests: Dict[str, Any] | None = None,
    action_plan_by_role: Dict[str, Any] | None = None,
    version_provenance: Dict[str, Any] | None = None,
    report_id: Any = None,
) -> Dict[str, Any]:
    """Compose one narrative from already-grounded, generation-time outputs."""
    synthesis = case_synthesis if isinstance(case_synthesis, dict) else {}
    safety = safety_result if isinstance(safety_result, dict) else {}
    escalation = doctor_escalation_precision if isinstance(doctor_escalation_precision, dict) else {}
    trend = trend_analysis if isinstance(trend_analysis, dict) else {}
    gaps = evidence_gaps if isinstance(evidence_gaps, dict) else {}
    provenance = version_provenance if isinstance(version_provenance, dict) else {}
    safety_level = _unified_safety_level(safety)
    safety_rank = _UNIFIED_SAFETY_RANK[safety_level]
    synthesis_version = _unified_source_version(synthesis, "case_synthesis_v1")
    safety_version = _unified_source_version(safety, provenance.get("safety_engine_version"))

    found = [
        _unified_statement(item, source_type="case_synthesis", source_version=synthesis_version)
        for item in (synthesis.get("what_was_found") or [])
        if isinstance(item, dict) and item.get("text") and _unified_safe_finding(item)
    ]
    connections = [
        _unified_statement(item, source_type="case_synthesis", source_version=synthesis_version)
        for item in (synthesis.get("symptom_connections") or [])
        if isinstance(item, dict) and item.get("text")
    ]
    limits = [
        _unified_statement(item, source_type="case_synthesis", source_version=synthesis_version, confidence_or_limit="explicit_limit")
        for item in [*(synthesis.get("contradictions_and_limits") or []), *(synthesis.get("missing_information") or [])]
        if isinstance(item, dict) and item.get("text")
    ]
    actions = [
        _unified_statement(item, source_type="case_synthesis", source_version=synthesis_version, safety_level=safety_level)
        for item in [*(synthesis.get("actions_now") or []), *(synthesis.get("clinician_discussion") or []), *(synthesis.get("retest_plan") or [])]
        if isinstance(item, dict) and item.get("text")
    ]
    if not actions:
        for bucket in ("urgent", "doctor", "practitioner", "self"):
            bucket_items = ((action_plan_by_role or {}).get("buckets") or {}).get(bucket) or []
            actions.extend(
                _unified_statement(
                    {"text": item.get("reason") or item.get("title"), "evidence": item.get("evidence") or []},
                    source_type="action_plan_by_role",
                    source_version=_unified_source_version(action_plan_by_role, provenance.get("action_plan_by_role_version")),
                    safety_level=safety_level,
                )
                for item in bucket_items
                if isinstance(item, dict) and (item.get("reason") or item.get("title"))
            )

    trend_items = []
    progress_items = []
    progress = progress_intelligence if isinstance(progress_intelligence, dict) else {}
    if progress.get("available"):
        evidence_by_pattern = {
            str(item.get("pattern_id")): item
            for item in (synthesis.get("what_was_found") or [])
            if isinstance(item, dict) and item.get("pattern_id")
        }
        for change in progress.get("changes") or []:
            if not isinstance(change, dict):
                continue
            source = evidence_by_pattern.get(str(change.get("pattern_id")))
            if not source or not _unified_refs(source):
                continue
            progress_items.append(_unified_statement(
                {
                    "text": (
                        f"{change.get('pattern_name') or change.get('pattern_id')} "
                        f"was {change.get('status')} compared with the previous report."
                    ),
                    "evidence": source.get("evidence"),
                },
                source_type="progress_intelligence",
                source_version=_unified_source_version(progress, provenance.get("progress_intelligence_version")),
                confidence_or_limit="pattern-level change",
            ))
    if trend.get("available"):
        trend_items = [
            item for item in (
                _unified_trend_statement(row, source_version=_unified_source_version(trend, provenance.get("trend_engine_version")))
                for row in (trend.get("priority_changes") or trend.get("trends") or [])
                if isinstance(row, dict)
            )
            if item is not None
        ]
    trend_items = [*progress_items, *trend_items]

    safety_evidence = _unified_safety_evidence(synthesis, safety)
    headline_source = "case_synthesis"
    headline_version = synthesis_version
    headline_text = None
    if safety_rank >= _UNIFIED_SAFETY_RANK["medical_review"] or safety.get("urgent_review_required"):
        headline_text = safety.get("prominent_user_warning")
        headline_source = "safety_result"
        headline_version = safety_version
        if not headline_text:
            escalations = escalation.get("escalations") or []
            headline_text = next(
                (item.get("human_readable_reason") for item in escalations if isinstance(item, dict) and item.get("human_readable_reason")),
                "This report includes a medical-review signal.",
            )
    elif safety_level == "insufficient_data":
        headline_text = "This report is limited by insufficient data."
        headline_source = "safety_result"
        headline_version = safety_version
    else:
        headline_text = next((item.get("text") for item in found), None)
        if not headline_text:
            headline_text = "This report is limited to the available measured biomarkers."

    priority = []
    if safety_rank >= _UNIFIED_SAFETY_RANK["medical_review"] or safety.get("urgent_review_required"):
        priority = [
            _unified_statement(item, source_type="safety_result", source_version=safety_version, safety_level=safety_level)
            for item in (synthesis.get("what_was_found") or [])
            if isinstance(item, dict) and item.get("text") and _unified_safe_finding(item)
        ][:3]
        if not priority:
            priority = [{
                "text": headline_text,
                "evidence": safety_evidence,
                "source_type": "safety_result",
                "source_version": safety_version,
                "confidence_or_limit": None,
                "related_markers": [item.get("id") for item in safety_evidence if item.get("type") == "biomarker"],
                "related_symptoms": [item.get("id") for item in safety_evidence if item.get("type") == "symptom"],
                "safety_level": safety_level,
            }]
    elif safety_level == "insufficient_data":
        priority = [{
            "text": headline_text,
            "evidence": safety_evidence,
            "source_type": "safety_result",
            "source_version": safety_version,
            "confidence_or_limit": "insufficient_data",
            "related_markers": [],
            "related_symptoms": [],
            "safety_level": safety_level,
        }]

    if safety_rank >= _UNIFIED_SAFETY_RANK["medical_review"] or safety_level == "insufficient_data":
        safety_action = {
            "text": headline_text,
            "evidence": safety_evidence,
            "source_type": "safety_result",
            "source_version": safety_version,
            "confidence_or_limit": None,
            "related_markers": [item.get("id") for item in safety_evidence if item.get("type") == "biomarker"],
            "related_symptoms": [item.get("id") for item in safety_evidence if item.get("type") == "symptom"],
            "safety_level": safety_level,
        }
        actions.insert(0, safety_action)

    return {
        "version": UNIFIED_PERSONAL_NARRATIVE_VERSION,
        "headline": {
            "text": headline_text,
            "evidence": safety_evidence if headline_source == "safety_result" else (found[0].get("evidence") if found else []),
            "source_type": headline_source,
            "source_version": headline_version,
            "confidence_or_limit": "insufficient_data" if safety_level == "insufficient_data" else None,
            "related_markers": [item.get("id") for item in (safety_evidence if headline_source == "safety_result" else (found[0].get("evidence") if found else [])) if item.get("type") == "biomarker"],
            "related_symptoms": [item.get("id") for item in (safety_evidence if headline_source == "safety_result" else (found[0].get("evidence") if found else [])) if item.get("type") == "symptom"],
            "safety_level": safety_level,
        },
        "what_we_found": found,
        "how_it_connects_to_you": connections,
        "what_changed_over_time": trend_items,
        "what_we_are_not_sure_about": limits,
        "why_this_is_priority": priority,
        "what_to_do_next": actions,
        "provenance": {
            "report_id": report_id,
            "pipeline_version": provenance.get("pipeline_version"),
            "case_synthesis_version": synthesis_version,
            "safety_engine_version": provenance.get("safety_engine_version"),
            "trend_engine_version": provenance.get("trend_engine_version"),
            "health_context_version": provenance.get("health_context_version"),
            "source_version": UNIFIED_PERSONAL_NARRATIVE_VERSION,
        },
    }
