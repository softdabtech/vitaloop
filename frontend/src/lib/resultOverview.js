/**
 * P4 user-result overview adapter.
 *
 * This module contains no clinical inference. It gives the Results page one
 * stable presentation contract over P1 Case Synthesis and the P3 grounded
 * narrative, while preserving the evidence already attached by the backend.
 * Old reports without either contract degrade to explicit empty states.
 */

function validObjects(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function evidenceKey(reference) {
  return [reference?.type, reference?.id, reference?.availability].map((part) => String(part || '')).join(':')
}

function dedupeEvidence(references) {
  const seen = new Set()
  return validObjects(references).filter((reference) => {
    const key = reference.evidence_id || evidenceKey(reference)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function narrativeItems(narrative, field, evidenceById) {
  return validObjects(narrative?.[field]).map((item) => ({
    text: cleanText(item.text),
    evidence: dedupeEvidence(
      (Array.isArray(item.evidence_ids) ? item.evidence_ids : [])
        .map((evidenceId) => evidenceById.get(String(evidenceId)))
        .filter(Boolean)
    ),
    source: 'grounded_ai_narrative',
    statementId: item.statement_id || null,
  })).filter((item) => item.text)
}

function synthesisItems(synthesis, ...fields) {
  return fields.flatMap((field) => validObjects(synthesis?.[field]).map((item) => ({
    text: cleanText(item.text),
    evidence: dedupeEvidence(item.evidence),
    source: 'case_synthesis',
    statementId: null,
  }))).filter((item) => item.text)
}

function plainItem(text, source, details = {}) {
  const normalized = cleanText(text)
  return normalized ? { text: normalized, evidence: [], source, statementId: null, ...details } : null
}

function dedupeItems(items) {
  const seen = new Set()
  return items.filter(Boolean).filter((item) => {
    const key = cleanText(item.text).toLocaleLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function firstAvailable(...collections) {
  return collections.find((items) => Array.isArray(items) && items.length) || []
}

function actionPlanItems(actionPlanByRole) {
  const buckets = actionPlanByRole?.buckets || actionPlanByRole || {}
  return ['urgent', 'doctor', 'practitioner', 'self'].flatMap((bucket) =>
    validObjects(buckets[bucket]).map((item) => plainItem(
      item.title || item.text || item.reason,
      'action_plan_by_role',
      { bucket }
    ))
  ).filter(Boolean)
}

function evidenceGapItems(evidenceGaps) {
  return validObjects(evidenceGaps?.gaps).map((gap) => {
    const marker = cleanText(gap.missing_marker || gap.marker || gap.label)
    const reason = cleanText(gap.reason || gap.description)
    const text = marker && reason ? `${marker}: ${reason}` : marker || reason
    return plainItem(text, 'evidence_gaps', { priority: gap.priority || null })
  }).filter(Boolean)
}

function escalationItems(doctorEscalationPrecision) {
  const levelOrder = { urgent: 0, doctor: 1 }
  return validObjects(doctorEscalationPrecision?.escalations)
    .filter((item) => item.level === 'urgent' || item.level === 'doctor')
    .sort((a, b) => levelOrder[a.level] - levelOrder[b.level])
    .map((item) => plainItem(
      item.human_readable_reason || item.title || item.reason,
      'doctor_escalation_precision',
      { level: item.level, timing: item.recommended_timing || null }
    ))
    .filter(Boolean)
}

function alertItems(reportAlerts) {
  return validObjects(reportAlerts).map((alert) => plainItem(
    alert.message || alert.title,
    'knowledge_report_safety_alert',
    { level: 'doctor' }
  )).filter(Boolean)
}

function safetyReasonItems(safetyResult) {
  return validObjects(safetyResult?.safety_events)
    .filter((event) => event.severity === 'critical' || event.severity === 'high')
    .map((event) => {
      const marker = event.item && typeof event.item === 'object' ? event.item : null
      const label = cleanText(marker?.name || marker?.canonical_name || marker?.source_name)
      const measured = marker?.value == null || marker?.value === ''
        ? ''
        : `${marker.value}${marker.unit ? ` ${marker.unit}` : ''}`
      const detail = label ? ` (${label}${measured ? `: ${measured}` : ''})` : ''
      const item = plainItem(
        `${cleanText(event.message)}${detail}`,
        'safety_result',
        { level: event.severity === 'critical' ? 'urgent' : 'doctor' }
      )
      if (item && marker && label) {
        item.evidence = [{
          type: 'biomarker',
          id: marker.canonical_name || marker.name || marker.source_name,
          label,
          availability: 'observed',
          value: marker.value,
          unit: marker.unit,
          status: marker.status,
        }]
      }
      return item
    })
    .filter(Boolean)
}

function legacyReportItems(knowledgeReport, field) {
  const value = knowledgeReport?.[field]
  const rows = Array.isArray(value) ? value : value ? [value] : []
  return rows.map((item) => {
    if (typeof item === 'string') return plainItem(item, 'legacy_report')
    if (!item || typeof item !== 'object') return null
    return plainItem(
      item.text || item.headline || item.summary || item.title || item.body || item.reason,
      'legacy_report'
    )
  }).filter(Boolean)
}

function legacyMarkerItems(priorityMarkers) {
  return validObjects(priorityMarkers).map((marker) => {
    const label = cleanText(marker.name_en || marker.canonical_name || marker.name || marker.source_name)
    if (!label) return null
    const value = marker.value == null || marker.value === '' ? '' : ` ${marker.value}${marker.unit ? ` ${marker.unit}` : ''}`
    return plainItem(`${label}${value}`, 'legacy_biomarker')
  }).filter(Boolean)
}

/**
 * @returns {{results: Array, connections: Array, actions: Array, missing: Array,
 *   consultation: Array, urgent: boolean, source: string, symptomImpactChanged: boolean}}
 */
export function buildResultOverview({
  groundedNarrative,
  caseSynthesis,
  actionPlanByRole,
  evidenceGaps,
  safetyResult,
  doctorEscalationPrecision,
  reportAlerts,
  urgentFallback,
  knowledgeReport,
  protocol,
  priorityMarkers,
} = {}) {
  const evidenceById = new Map(
    validObjects(groundedNarrative?.evidence_links)
      .filter((item) => item.evidence_id)
      .map((item) => [String(item.evidence_id), item])
  )

  const narrativeResults = [
    ...narrativeItems(groundedNarrative, 'personalized_summary', evidenceById),
    ...narrativeItems(groundedNarrative, 'key_connections', evidenceById),
  ]
  const synthesisResults = synthesisItems(caseSynthesis, 'main_conclusion', 'what_was_found')
  const legacyResults = dedupeItems([
    ...legacyReportItems(knowledgeReport, 'summary'),
    ...legacyReportItems(knowledgeReport, 'what_was_found'),
    ...legacyMarkerItems(priorityMarkers),
  ])

  const narrativeConnections = narrativeItems(groundedNarrative, 'symptom_lab_correlations', evidenceById)
  const synthesisConnections = synthesisItems(caseSynthesis, 'symptom_connections')
  const legacyConnections = legacyReportItems(knowledgeReport, 'why_it_matters')

  const narrativeActions = narrativeItems(groundedNarrative, 'next_actions', evidenceById)
  const synthesisActions = synthesisItems(caseSynthesis, 'actions_now')
  const legacyActions = dedupeItems([
    ...legacyReportItems(knowledgeReport, 'action_plan'),
    ...(Array.isArray(protocol) ? protocol : []).map((item) =>
      plainItem(typeof item === 'string' ? item : item?.title || item?.text || item?.recommendation, 'legacy_protocol')
    ).filter(Boolean),
  ])

  const synthesisMissing = synthesisItems(caseSynthesis, 'missing_information')
  const gapItems = evidenceGapItems(evidenceGaps)
  const narrativeUncertainties = narrativeItems(groundedNarrative, 'uncertainties', evidenceById)

  const urgent = Boolean(safetyResult?.urgent_review_required)
  const safetyReasons = safetyReasonItems(safetyResult)
  const urgentItem = urgent && !safetyReasons.length
    ? plainItem(safetyResult?.prominent_user_warning || urgentFallback, 'safety_result', { level: 'urgent' })
    : null
  const escalations = escalationItems(doctorEscalationPrecision)
  const alerts = alertItems(reportAlerts)
  const narrativeConsultation = narrativeItems(groundedNarrative, 'clinician_questions', evidenceById)
  const synthesisConsultation = synthesisItems(caseSynthesis, 'clinician_discussion')
  const legacyConsultation = legacyReportItems(knowledgeReport, 'doctor_discussion')

  return {
    results: dedupeItems(firstAvailable(narrativeResults, synthesisResults, legacyResults)).slice(0, 5),
    connections: dedupeItems(firstAvailable(narrativeConnections, synthesisConnections, legacyConnections)).slice(0, 5),
    actions: dedupeItems(firstAvailable(narrativeActions, synthesisActions, actionPlanItems(actionPlanByRole), legacyActions)).slice(0, 3),
    missing: dedupeItems(firstAvailable(synthesisMissing, gapItems, narrativeUncertainties)).slice(0, 5),
    consultation: dedupeItems([
      urgentItem,
      ...safetyReasons,
      ...escalations,
      ...alerts,
      ...firstAvailable(narrativeConsultation, synthesisConsultation, legacyConsultation),
    ]).slice(0, 5),
    urgent,
    source: narrativeResults.length ? 'grounded_ai_narrative' : synthesisResults.length ? 'case_synthesis' : 'legacy',
    narrativeSource: groundedNarrative?.source || null,
    fallbackUsed: Boolean(groundedNarrative?.grounding?.fallback_used),
    fallbackReason: groundedNarrative?.grounding?.fallback_reason || null,
    symptomImpactChanged: Boolean(caseSynthesis?.symptom_impact?.changed),
  }
}
