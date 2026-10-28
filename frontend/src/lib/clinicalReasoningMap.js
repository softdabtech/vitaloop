/**
 * P18 Clinical Reasoning Map — adapter layer.
 *
 * Pure presentation adapter over P14-P17 backend fields
 * (clinical_hypotheses, clinical_contradictions, confidence_calibration,
 * clinical_reasoning_traces, evidence_gaps, next_test_funnel,
 * action_plan_by_role, negative_evidence). No new clinical logic here —
 * this only reshapes already-computed backend output into a small,
 * render-ready `cards` list for ClinicalReasoningMapSection, so the
 * component itself never has to reach into five different raw shapes.
 *
 * Every input is optional. A missing/malformed field degrades that part
 * of a card (or drops the card) rather than throwing — an old report
 * generated before P14-P17 existed simply produces an empty `cards` list,
 * which the section renders as a calm empty state using P17
 * negative_evidence when available.
 */

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function findReasoningTraceFor(traces, hypothesisId) {
  return asArray(traces).find((trace) => trace && String(trace.pattern_id) === String(hypothesisId)) || null
}

function contradictionsFor(contradictions, domain, hypothesisId) {
  return asArray(contradictions).filter((item) => {
    if (!item) return false
    const sameDomain = String(item.domain || '').toLowerCase() === String(domain || '').toLowerCase()
    const related = asArray(item.related_hypotheses).map(String).includes(String(hypothesisId))
    return sameDomain || related
  })
}

function actionBucketFor(actionPlanByRole, hypothesisId, fallback) {
  if (actionPlanByRole && typeof actionPlanByRole === 'object') {
    for (const bucket of ['urgent', 'doctor', 'practitioner', 'self']) {
      const items = asArray(actionPlanByRole[bucket])
      if (items.some((item) => item && item.source === 'pattern' && String(item.source_id) === String(hypothesisId))) {
        return bucket
      }
    }
  }
  return fallback
}

// Fallback bucket when no action_plan_by_role entry matches this
// hypothesis directly (e.g. an older report, or a hypothesis with no
// matching pattern trace) — mirrors action_plan_by_role.py's own
// priority order (urgent > doctor > practitioner > self) using only the
// calibration fields every hypothesis already carries.
function fallbackActionBucket(hypothesis) {
  if (hypothesis?.doctor_only || hypothesis?.calibrated_confidence === 'doctor_only') return 'doctor'
  if (hypothesis?.calibrated_confidence === 'blocked' || hypothesis?.blocked) return 'practitioner'
  const confidence = hypothesis?.calibrated_confidence || hypothesis?.likelihood_bucket
  if (confidence === 'moderate' || confidence === 'possible') return 'practitioner'
  return 'self'
}

function buildCard(hypothesis, { reasoningTraces, contradictions, evidenceGaps, actionPlanByRole }) {
  if (!hypothesis || typeof hypothesis !== 'object' || !hypothesis.hypothesis_id) return null
  const hypothesisId = hypothesis.hypothesis_id
  const domain = hypothesis.domain
  const trace = findReasoningTraceFor(reasoningTraces, hypothesisId)
  const matchedContradictions = contradictionsFor(contradictions, domain, hypothesisId)

  const domainGaps = asArray(evidenceGaps?.gaps).filter(
    (gap) => gap && String(gap.domain || '').toLowerCase() === String(domain || '').toLowerCase()
  )

  const confidenceLabel = hypothesis.calibrated_confidence || hypothesis.likelihood_bucket || null
  const confidenceScore = Number.isFinite(hypothesis.calibrated_score)
    ? hypothesis.calibrated_score
    : Number.isFinite(hypothesis.confidence_score)
      ? hypothesis.confidence_score
      : null

  return {
    id: hypothesisId,
    domain,
    title: hypothesis.label || trace?.pattern_name || hypothesisId,
    confidenceLabel,
    confidenceScore,
    actionBucket: actionBucketFor(actionPlanByRole, hypothesisId, fallbackActionBucket(hypothesis)),
    symptoms: asArray(trace?.matched_symptoms),
    supportingMarkers: asArray(hypothesis.supporting_evidence).map(
      (m) => (typeof m === 'string' ? m : m?.name || m?.canonical_name || '')
    ).filter(Boolean),
    hypothesis: hypothesis.reasoning_statement || trace?.user_explanation?.summary || null,
    contradictions: matchedContradictions.map((c) => c.message).filter(Boolean),
    evidenceGaps: domainGaps.map((g) => g.reason || g.missing_marker).filter(Boolean),
    nextTests: asArray(hypothesis.what_would_confirm_or_rule_out).map(
      (t) => (typeof t === 'string' ? t : t?.marker || t?.name || '')
    ).filter(Boolean),
    negativeEvidenceContext: null,
    explanation: hypothesis.reasoning_statement || null,
  }
}

/**
 * @returns {{ cards: Array<object>, stableDomains: Array, underTestedDomains: Array }}
 */
export function buildClinicalReasoningMap({
  clinicalHypotheses,
  clinicalContradictions,
  reasoningTraces,
  evidenceGaps,
  actionPlanByRole,
  negativeEvidence,
  maxCards = 3,
} = {}) {
  const hypotheses = asArray(clinicalHypotheses?.hypotheses)
  const contradictions = asArray(clinicalContradictions?.contradictions)

  const cards = hypotheses
    .slice(0, maxCards)
    .map((hypothesis) =>
      buildCard(hypothesis, { reasoningTraces, contradictions, evidenceGaps, actionPlanByRole })
    )
    .filter(Boolean)

  return {
    cards,
    stableDomains: asArray(negativeEvidence?.stable_domains),
    underTestedDomains: asArray(negativeEvidence?.under_tested_domains),
  }
}
