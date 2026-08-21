from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple
from uuid import UUID

from app.services import supabase_service as supabase
from app.services.knowledge.nutrition_algorithms import build_nutrition_kb_context


FORBIDDEN_PHRASES = ["confirmed diagnosis"]

SEVERITY_MULTIPLIER = {
    "low": 0.95,
    "moderate": 1.0,
    "high": 1.08,
    "critical": 1.15,
}

EVIDENCE_MULTIPLIER = {
    "low": 0.9,
    "moderate": 1.0,
    "high": 1.08,
    "guideline_placeholder": 0.98,
    "clinical_guideline_context": 0.98,
}


def _public_evidence_level(value: Any) -> str | None:
    raw = str(value or "").strip().lower()
    if not raw:
        return None
    if "placeholder" in raw:
        return "clinical_guideline_context"
    return raw


def _normalize_unit(value: str | None) -> str:
    raw = str(value or "").strip().lower().replace("μ", "u").replace("µ", "u")
    aliases = {
        "miu/l": "uiu/ml",
        "mu/l": "uiu/ml",
        "uiu/ml": "uiu/ml",
        "u iu/ml": "uiu/ml",
    }
    return aliases.get(raw, raw)


def _convert_value(marker_key: str, value: float, from_unit: str, to_unit: str) -> float | None:
    marker = str(marker_key).strip().lower()
    src = _normalize_unit(from_unit)
    dst = _normalize_unit(to_unit)
    if src == dst:
        return value

    if marker == "glucose":
        if src == "mmol/l" and dst == "mg/dl":
            return value * 18.0
        if src == "mg/dl" and dst == "mmol/l":
            return value / 18.0

    if marker in {"ldl", "hdl"}:
        if src == "mmol/l" and dst == "mg/dl":
            return value * 38.67
        if src == "mg/dl" and dst == "mmol/l":
            return value / 38.67

    if marker == "triglycerides":
        if src == "mmol/l" and dst == "mg/dl":
            return value * 88.57
        if src == "mg/dl" and dst == "mmol/l":
            return value / 88.57

    if marker == "vitamin_d":
        if src == "nmol/l" and dst == "ng/ml":
            return value / 2.5
        if src == "ng/ml" and dst == "nmol/l":
            return value * 2.5

    if marker == "ferritin":
        if src == "ng/ml" and dst == "ug/l":
            return value
        if src == "ug/l" and dst == "ng/ml":
            return value

    return None


def _is_uuid(value: str | None) -> bool:
    if not value:
        return False
    try:
        UUID(value)
        return True
    except (ValueError, TypeError):
        return False


def _normalize_symptoms(raw: Any) -> set[str]:
    if not isinstance(raw, list):
        return set()
    normalized: set[str] = set()
    for item in raw:
        if item is None:
            continue
        normalized.add(str(item).strip().lower())
    return normalized


def _to_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _unit_matches(actual_unit: str | None, expected_unit: str | None) -> bool:
    if not expected_unit:
        return True
    if not actual_unit:
        return False
    return str(actual_unit).strip().lower() == str(expected_unit).strip().lower()


def _evaluate_operator(operator: str, actual: float, expected: Any) -> bool:
    op = (operator or "").strip().lower()
    if op == "lt":
        threshold = _to_float(expected)
        return threshold is not None and actual < threshold
    if op == "lte":
        threshold = _to_float(expected)
        return threshold is not None and actual <= threshold
    if op == "gt":
        threshold = _to_float(expected)
        return threshold is not None and actual > threshold
    if op == "gte":
        threshold = _to_float(expected)
        return threshold is not None and actual >= threshold
    if op == "eq":
        threshold = _to_float(expected)
        return threshold is not None and actual == threshold
    if op == "between":
        if not isinstance(expected, list) or len(expected) != 2:
            return False
        left = _to_float(expected[0])
        right = _to_float(expected[1])
        return left is not None and right is not None and left <= actual <= right
    return False


def _render_explanation(template: str, lab_results: Dict[str, Any]) -> str:
    explanation = template or "Rule matched based on provided health inputs."
    context: Dict[str, str] = {}
    for marker_key, marker_data in lab_results.items():
        if not isinstance(marker_data, dict):
            continue
        value = marker_data.get("value")
        unit = marker_data.get("unit")
        context[f"{marker_key}_value"] = "" if value is None else str(value)
        context[f"{marker_key}_unit"] = "" if unit is None else str(unit)

    for key, value in context.items():
        explanation = explanation.replace(f"{{{{{key}}}}}", value)
    return explanation


def _evaluate_atom(condition: Dict[str, Any], lab_results: Dict[str, Any], symptoms: set[str]) -> Tuple[bool, Dict[str, Any]]:
    marker_key = condition.get("lab_marker")
    if marker_key:
        marker_key = str(marker_key).strip().lower()
        marker_data = lab_results.get(marker_key)
        if not isinstance(marker_data, dict):
            return False, {"type": "lab_marker", "key": marker_key, "reason": "missing_marker"}

        value = _to_float(marker_data.get("value"))
        if value is None:
            return False, {"type": "lab_marker", "key": marker_key, "reason": "missing_value"}

        expected_unit = condition.get("unit")
        actual_unit = marker_data.get("unit")
        eval_value = value
        converted = False
        conversion_error = None

        if expected_unit and not _unit_matches(actual_unit, expected_unit):
            converted_value = _convert_value(marker_key, value, str(actual_unit or ""), str(expected_unit))
            if converted_value is None:
                conversion_error = "unsupported_conversion"
                return False, {
                    "type": "lab_marker",
                    "key": marker_key,
                    "reason": "unit_mismatch",
                    "actual_unit": actual_unit,
                    "expected_unit": expected_unit,
                    "conversion_error": conversion_error,
                }
            eval_value = converted_value
            converted = True

        matched = _evaluate_operator(str(condition.get("operator") or ""), eval_value, condition.get("value"))
        return matched, {
            "type": "lab_marker",
            "key": marker_key,
            "value": value,
            "evaluated_value": eval_value,
            "unit": actual_unit,
            "expected_unit": expected_unit,
            "converted": converted,
            "operator": condition.get("operator"),
            "threshold": condition.get("value"),
            "matched": matched,
        }

    symptom_key = condition.get("symptom")
    if symptom_key:
        symptom_key = str(symptom_key).strip().lower()
        matched = symptom_key in symptoms
        return matched, {
            "type": "symptom",
            "key": symptom_key,
            "matched": matched,
        }

    return False, {"reason": "unsupported_condition_atom", "condition": condition}


def _evaluate_conditions_tree(conditions: Dict[str, Any], lab_results: Dict[str, Any], symptoms: set[str]) -> Tuple[bool, List[Dict[str, Any]]]:
    if "all" in conditions:
        raw_items = conditions.get("all")
        items = raw_items if isinstance(raw_items, list) else []
        evidence: List[Dict[str, Any]] = []
        for item in items:
            if not isinstance(item, dict):
                evidence.append({"reason": "invalid_condition_item"})
                return False, evidence
            matched, item_evidence = _evaluate_conditions_tree(item, lab_results, symptoms)
            evidence.append(
                {
                    "operator": "all",
                    "matched": matched,
                    "items": item_evidence,
                }
            )
            if not matched:
                return False, evidence
        return True, evidence

    if "any" in conditions:
        raw_items = conditions.get("any")
        items = raw_items if isinstance(raw_items, list) else []
        evidence: List[Dict[str, Any]] = []
        any_matched = False
        for item in items:
            if not isinstance(item, dict):
                evidence.append({"reason": "invalid_condition_item", "matched": False})
                continue
            matched, item_evidence = _evaluate_conditions_tree(item, lab_results, symptoms)
            evidence.append(
                {
                    "operator": "any",
                    "matched": matched,
                    "items": item_evidence,
                }
            )
            any_matched = any_matched or matched
        return any_matched, evidence

    matched, atom_evidence = _evaluate_atom(conditions, lab_results, symptoms)
    atom_evidence["matched"] = matched
    return matched, [atom_evidence]


def evaluate_input_with_rules(input_data: Dict[str, Any], rules: List[Dict[str, Any]]) -> Dict[str, Any]:
    lab_results_raw = input_data.get("lab_results") if isinstance(input_data, dict) else {}
    lab_results = lab_results_raw if isinstance(lab_results_raw, dict) else {}
    lab_results = {str(k).strip().lower(): v for k, v in lab_results.items()}
    symptoms = _normalize_symptoms(input_data.get("symptoms") if isinstance(input_data, dict) else [])

    matched_rules: List[Dict[str, Any]] = []
    recommendation_keys: List[str] = []

    for rule in rules:
        if not bool(rule.get("active", True)):
            continue

        governance_status = str(rule.get("governance_status") or "active").strip().lower()
        if governance_status != "active":
            continue

        conditions = rule.get("conditions")
        if not isinstance(conditions, dict):
            continue

        matched, evidence = _evaluate_conditions_tree(conditions, lab_results, symptoms)
        if not matched:
            continue

        outputs = rule.get("outputs") if isinstance(rule.get("outputs"), dict) else {}
        output_recommendations = outputs.get("recommendation_keys")
        if isinstance(output_recommendations, list):
            for key in output_recommendations:
                if key is None:
                    continue
                recommendation_keys.append(str(key))

        explanation_template = str(rule.get("explanation_template") or "")
        explanation = _render_explanation(explanation_template, lab_results)

        matched_rules.append(
            {
                "rule_id": str(rule.get("id") or ""),
                "rule_key": str(rule.get("key") or ""),
                "name": str(rule.get("name") or ""),
                "description": str(rule.get("description") or ""),
                "risk": outputs.get("risk"),
                "summary": outputs.get("summary"),
                "recommendation_keys": output_recommendations or [],
                "confidence": float(rule.get("confidence") or 0),
                "severity": rule.get("severity"),
                "requires_doctor": bool(rule.get("requires_doctor", False)),
                "explanation": explanation,
                "source": rule.get("source"),
                "source_url": rule.get("source_url"),
                "evidence": evidence,
                "input_entities": rule.get("input_entities") if isinstance(rule.get("input_entities"), list) else [],
            }
        )

    deduped_recommendation_keys = list(dict.fromkeys(recommendation_keys))

    source_refs: List[Dict[str, str]] = []
    seen_refs: set[tuple[str, str]] = set()
    for rule in matched_rules:
        source = str(rule.get("source") or "").strip()
        source_url = str(rule.get("source_url") or "").strip()
        if not source and not source_url:
            continue
        ref_key = (source, source_url)
        if ref_key in seen_refs:
            continue
        seen_refs.add(ref_key)
        source_refs.append({"source": source, "source_url": source_url})

    return {
        "matched_rules": matched_rules,
        "recommendation_keys": deduped_recommendation_keys,
        "requires_doctor": any(bool(r.get("requires_doctor")) for r in matched_rules),
        "max_confidence": max([float(r.get("confidence") or 0) for r in matched_rules], default=0.0),
        "source_references": source_refs,
    }


async def _load_active_rules() -> List[Dict[str, Any]]:
    client = supabase._get_supabase()
    response = await supabase._run(
        lambda: client.table("knowledge_rules")
        .select(
            "id,key,name,description,input_entities,conditions,outputs,confidence,severity,requires_doctor,explanation_template,source,source_url,active,governance_status"
        )
        .eq("active", True)
        .eq("governance_status", "active")
        .execute()
    )
    return response.data or []


async def _load_recommendations(recommendation_keys: List[str]) -> Dict[str, Dict[str, Any]]:
    if not recommendation_keys:
        return {}

    client = supabase._get_supabase()
    response = await supabase._run(
        lambda: client.table("recommendations")
        .select("id,key,title,body,category,priority,requires_doctor,evidence_level,source,source_url")
        .in_("key", recommendation_keys)
        .execute()
    )
    rows = response.data or []
    cleaned_rows: List[Dict[str, Any]] = []
    for row in rows:
        cleaned = dict(row)
        cleaned["evidence_level"] = _public_evidence_level(cleaned.get("evidence_level"))
        cleaned_rows.append(cleaned)
    return {str(row.get("key")): row for row in cleaned_rows}


async def _persist_rule_evaluation(user_id: str | None, rule_match: Dict[str, Any], input_snapshot: Dict[str, Any]) -> str | None:
    rule_id = str(rule_match.get("rule_id") or "").strip()
    if not rule_id:
        return None

    payload: Dict[str, Any] = {
        "rule_id": rule_id,
        "input_snapshot": input_snapshot,
        "result": {
            "risk": rule_match.get("risk"),
            "summary": rule_match.get("summary"),
            "recommendation_keys": rule_match.get("recommendation_keys") or [],
            "requires_doctor": bool(rule_match.get("requires_doctor")),
            "source": rule_match.get("source"),
            "source_url": rule_match.get("source_url"),
            "evidence": rule_match.get("evidence") or [],
        },
        "explanation": rule_match.get("explanation"),
        "confidence": rule_match.get("confidence"),
    }
    if _is_uuid(user_id):
        payload["user_id"] = user_id

    client = supabase._get_supabase()
    response = await supabase._run(lambda: client.table("rule_evaluations").insert(payload).execute())
    rows = response.data or []
    inserted_id = str(rows[0].get("id") or "").strip() if rows else ""
    return inserted_id or None


def _clean_medical_wording(text: str) -> str:
    cleaned = text
    for phrase in FORBIDDEN_PHRASES:
        cleaned = cleaned.replace(phrase, "possible risk")
        cleaned = cleaned.replace(phrase.title(), "Possible risk")
    return cleaned


def _freshness_multiplier(context: Dict[str, Any]) -> float:
    age_days = context.get("data_age_days")
    if isinstance(age_days, (int, float)):
        if age_days <= 30:
            return 1.0
        if age_days <= 90:
            return 0.96
        if age_days <= 180:
            return 0.9
        return 0.82

    sample_collected_at = context.get("sample_collected_at")
    if isinstance(sample_collected_at, str) and sample_collected_at.strip():
        try:
            parsed = datetime.fromisoformat(sample_collected_at.replace("Z", "+00:00"))
            age_days_derived = max(0.0, (datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)).total_seconds() / 86400.0)
            return _freshness_multiplier({"data_age_days": age_days_derived})
        except ValueError:
            return 0.9

    return 0.92


def _missing_data_multiplier(matched_rules: List[Dict[str, Any]], lab_results: Dict[str, Any], symptoms: set[str]) -> float:
    expected_markers: set[str] = set()
    expected_symptoms: set[str] = set()
    for rule in matched_rules:
        for key in rule.get("input_entities") or []:
            entity_key = str(key).strip().lower()
            if entity_key in lab_results:
                expected_markers.add(entity_key)
            elif entity_key in symptoms:
                expected_symptoms.add(entity_key)
            else:
                expected_markers.add(entity_key)

    expected_total = len(expected_markers) + len(expected_symptoms)
    if expected_total == 0:
        return 1.0

    available_markers = sum(1 for key in expected_markers if key in lab_results)
    available_symptoms = sum(1 for key in expected_symptoms if key in symptoms)
    available = available_markers + available_symptoms
    missing_ratio = max(0.0, min(1.0, (expected_total - available) / expected_total))
    return max(0.75, 1.0 - (missing_ratio * 0.25))


def _combined_confidence(
    *,
    matched_rules: List[Dict[str, Any]],
    lab_results: Dict[str, Any],
    symptoms: set[str],
    context: Dict[str, Any],
    generated_recommendations: List[Dict[str, Any]],
) -> float:
    if not matched_rules:
        return 0.0

    base = max(float(rule.get("confidence") or 0.0) for rule in matched_rules)

    total_atoms = 0
    matched_atoms = 0
    for rule in matched_rules:
        for item in rule.get("evidence") or []:
            rule_items = item.get("items") if isinstance(item, dict) else None
            if isinstance(rule_items, list):
                for atom in rule_items:
                    if isinstance(atom, dict):
                        total_atoms += 1
                        matched_atoms += 1 if atom.get("matched") else 0
            elif isinstance(item, dict):
                total_atoms += 1
                matched_atoms += 1 if item.get("matched") else 0

    factor_quality = 1.0 if total_atoms == 0 else max(0.85, matched_atoms / total_atoms)

    severity_score = max(
        [SEVERITY_MULTIPLIER.get(str(rule.get("severity") or "").lower(), 1.0) for rule in matched_rules],
        default=1.0,
    )

    freshness_score = _freshness_multiplier(context)
    missing_score = _missing_data_multiplier(matched_rules, lab_results, symptoms)

    evidence_levels = [
        str(item.get("evidence_level") or "").strip().lower()
        for item in generated_recommendations
        if isinstance(item, dict)
    ]
    if evidence_levels:
        evidence_score = max(EVIDENCE_MULTIPLIER.get(level, 0.98) for level in evidence_levels)
    else:
        evidence_score = 0.98

    combined = base * factor_quality * severity_score * freshness_score * missing_score * evidence_score
    return round(max(0.0, min(1.0, combined)), 3)


def _safety_alerts(lab_results: Dict[str, Any]) -> List[Dict[str, Any]]:
    alerts: List[Dict[str, Any]] = []

    def add_alert(marker: str, value: float, unit: str, message: str) -> None:
        alerts.append(
            {
                "marker": marker,
                "value": value,
                "unit": unit,
                "requires_doctor": True,
                "message": _clean_medical_wording(message),
            }
        )

    def read(marker: str, target_unit: str) -> float | None:
        row = lab_results.get(marker)
        if not isinstance(row, dict):
            return None
        value = _to_float(row.get("value"))
        if value is None:
            return None
        unit = str(row.get("unit") or "")
        converted = _convert_value(marker, value, unit, target_unit)
        if converted is None and _normalize_unit(unit) != _normalize_unit(target_unit):
            return None
        return value if converted is None else converted

    glucose = read("glucose", "mg/dl")
    if glucose is not None and (glucose >= 300 or glucose <= 54):
        add_alert("glucose", glucose, "mg/dL", "Critical glucose value may indicate urgent risk and requires medical review.")

    hba1c = read("hba1c", "%")
    if hba1c is not None and hba1c >= 9.0:
        add_alert("hba1c", hba1c, "%", "HbA1c may indicate significantly elevated diabetes risk and requires medical review.")

    alt = read("alt", "U/L")
    if alt is not None and alt >= 150:
        add_alert("alt", alt, "U/L", "ALT may indicate significant liver enzyme elevation and requires medical review.")

    ast = read("ast", "U/L")
    if ast is not None and ast >= 120:
        add_alert("ast", ast, "U/L", "AST may indicate significant liver enzyme elevation and requires medical review.")

    ldl = read("ldl", "mg/dl")
    if ldl is not None and ldl >= 190:
        add_alert("ldl", ldl, "mg/dL", "LDL may indicate high cardiovascular risk and requires medical review.")

    vitamin_d = read("vitamin_d", "ng/ml")
    if vitamin_d is not None and vitamin_d < 10:
        add_alert("vitamin_d", vitamin_d, "ng/mL", "Vitamin D level may indicate severe insufficiency and requires medical review.")

    return alerts


async def _audit_medical_output(user_id: str | None, output_payload: Dict[str, Any]) -> None:
    await supabase.write_audit_log(
        user_id=user_id if _is_uuid(user_id) else None,
        action="read",
        entity_type="knowledge_output",
        entity_id=None,
        new_value=output_payload,
    )


async def evaluate_health_input(
    input_data: Dict[str, Any],
    *,
    user_id: str | None = None,
    persist: bool = True,
) -> Dict[str, Any]:
    context_raw = input_data.get("context") if isinstance(input_data, dict) else {}
    context = context_raw if isinstance(context_raw, dict) else {}

    lab_results_raw = input_data.get("lab_results") if isinstance(input_data, dict) else {}
    lab_results_input = lab_results_raw if isinstance(lab_results_raw, dict) else {}
    lab_results = {str(k).strip().lower(): v for k, v in lab_results_input.items()}
    symptoms = _normalize_symptoms(input_data.get("symptoms") if isinstance(input_data, dict) else [])

    rules = await _load_active_rules()
    evaluated = evaluate_input_with_rules(input_data, rules)
    nutrition_context = build_nutrition_kb_context(input_data)

    recommendations_map = await _load_recommendations(evaluated["recommendation_keys"])
    generated_recommendations: List[Dict[str, Any]] = []
    recommendation_refs: List[Dict[str, str]] = []
    seen_refs: set[tuple[str, str]] = set()

    for key in evaluated["recommendation_keys"]:
        row = recommendations_map.get(key)
        if not row:
            continue
        generated_recommendations.append(
            {
                "key": row.get("key"),
                "title": row.get("title"),
                "body": row.get("body"),
                "category": row.get("category"),
                "priority": row.get("priority"),
                "requires_doctor": bool(row.get("requires_doctor", False)),
                "evidence_level": _public_evidence_level(row.get("evidence_level")),
                "source": row.get("source"),
                "source_url": row.get("source_url"),
            }
        )

        source = str(row.get("source") or "").strip()
        source_url = str(row.get("source_url") or "").strip()
        ref_key = (source, source_url)
        if source or source_url:
            if ref_key not in seen_refs:
                seen_refs.add(ref_key)
                recommendation_refs.append({"source": source, "source_url": source_url})

    for item in nutrition_context.get("generated_recommendations") or []:
        if not isinstance(item, dict):
            continue
        generated_recommendations.append(item)
        source = str(item.get("source") or "").strip()
        source_url = str(item.get("source_url") or "").strip()
        ref_key = (source, source_url)
        if source or source_url:
            if ref_key not in seen_refs:
                seen_refs.add(ref_key)
                recommendation_refs.append({"source": source, "source_url": source_url})

    evaluation_ids: List[str] = []
    if persist:
        for matched in evaluated["matched_rules"]:
            inserted_id = await _persist_rule_evaluation(user_id, matched, input_data)
            if inserted_id:
                evaluation_ids.append(inserted_id)

    safety_alerts = _safety_alerts(lab_results)
    requires_doctor = bool(evaluated["requires_doctor"]) or any(bool(item.get("requires_doctor")) for item in generated_recommendations)
    if safety_alerts:
        requires_doctor = True

    source_references = evaluated["source_references"] + recommendation_refs
    deduped_source_references: List[Dict[str, str]] = []
    seen_combined: set[tuple[str, str]] = set()
    for item in source_references:
        source = str(item.get("source") or "").strip()
        source_url = str(item.get("source_url") or "").strip()
        ref_key = (source, source_url)
        if ref_key in seen_combined:
            continue
        seen_combined.add(ref_key)
        deduped_source_references.append({"source": source, "source_url": source_url})

    cleaned_rules = []
    for rule in evaluated["matched_rules"]:
        cleaned_rule = dict(rule)
        cleaned_rule["explanation"] = _clean_medical_wording(str(cleaned_rule.get("explanation") or ""))
        cleaned_rule["summary"] = _clean_medical_wording(str(cleaned_rule.get("summary") or ""))
        cleaned_rules.append(cleaned_rule)

    cleaned_recommendations = []
    for item in generated_recommendations:
        cleaned_item = dict(item)
        cleaned_item["body"] = _clean_medical_wording(str(cleaned_item.get("body") or ""))
        cleaned_recommendations.append(cleaned_item)

    computed_confidence = _combined_confidence(
        matched_rules=cleaned_rules,
        lab_results=lab_results,
        symptoms=symptoms,
        context=context,
        generated_recommendations=cleaned_recommendations,
    )

    output = {
        "matched_rules": cleaned_rules,
        "generated_recommendations": cleaned_recommendations,
        "requires_doctor": requires_doctor,
        "max_confidence": evaluated["max_confidence"],
        "confidence": computed_confidence,
        "safety_alerts": safety_alerts,
        "source_references": deduped_source_references,
        "rule_evaluation_ids": evaluation_ids,
        "nutrition_context": nutrition_context,
    }

    if persist:
        await _audit_medical_output(user_id, output)

    return output
