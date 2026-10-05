import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildResultOverview } from '../resultOverview.js'

function statement(text, evidenceIds = ['bio:ferritin:observed']) {
  return { statement_id: `statement:${text}`, text, evidence_ids: evidenceIds }
}

const narrative = {
  personalized_summary: [statement('Ferritin deserves attention.')],
  key_connections: [statement('The iron pattern is the main current signal.')],
  symptom_lab_correlations: [statement('Fatigue may be consistent with the iron pattern.')],
  uncertainties: [statement('Inflammation context is not available.')],
  next_actions: [statement('Action one.'), statement('Action two.'), statement('Action three.'), statement('Action four.')],
  clinician_questions: [statement('Ask whether iron studies are appropriate.')],
  evidence_links: [{
    evidence_id: 'bio:ferritin:observed',
    type: 'biomarker',
    id: 'ferritin',
    label: 'Ferritin',
    availability: 'observed',
    value: 14,
    unit: 'ng/mL',
  }],
}

describe('buildResultOverview', () => {
  it('prefers the grounded P3 narrative and resolves evidence references', () => {
    const result = buildResultOverview({
      groundedNarrative: narrative,
      caseSynthesis: { main_conclusion: [{ text: 'Fallback.', evidence: [] }] },
    })

    assert.equal(result.source, 'grounded_ai_narrative')
    assert.equal(result.results[0].text, 'Ferritin deserves attention.')
    assert.deepEqual(
      { label: result.results[0].evidence[0].label, value: result.results[0].evidence[0].value, unit: result.results[0].evidence[0].unit },
      { label: 'Ferritin', value: 14, unit: 'ng/mL' }
    )
  })

  it('shows exactly three priority actions when more are available', () => {
    const result = buildResultOverview({ groundedNarrative: narrative })

    assert.deepEqual(result.actions.map((item) => item.text), ['Action one.', 'Action two.', 'Action three.'])
  })

  it('falls back to report-specific Case Synthesis fields', () => {
    const evidence = [{ type: 'biomarker', id: 'tsh', label: 'TSH', availability: 'observed' }]
    const result = buildResultOverview({
      caseSynthesis: {
        main_conclusion: [{ text: 'TSH is the main finding.', evidence }],
        symptom_connections: [{ text: 'Cold sensitivity may connect to this pattern.', evidence }],
        actions_now: [{ text: 'Review TSH with a clinician.', evidence }],
        missing_information: [{ text: 'Free T4 is missing.', evidence }],
        clinician_discussion: [{ text: 'Ask about thyroid follow-up.', evidence }],
      },
    })

    assert.equal(result.source, 'case_synthesis')
    assert.match(result.results[0].text, /TSH/)
    assert.match(result.connections[0].text, /Cold sensitivity/)
    assert.match(result.missing[0].text, /Free T4/)
  })

  it('places an urgent safety warning before clinician discussion items', () => {
    const result = buildResultOverview({
      groundedNarrative: narrative,
      safetyResult: { urgent_review_required: true, prominent_user_warning: 'Seek prompt medical review.' },
      doctorEscalationPrecision: {
        escalations: [{ level: 'doctor', human_readable_reason: 'Discuss this finding.', recommended_timing: 'soon' }],
      },
    })

    assert.equal(result.urgent, true)
    assert.equal(result.consultation[0].text, 'Seek prompt medical review.')
    assert.equal(result.consultation[0].level, 'urgent')
  })

  it('uses explicit missing-information statements ahead of generic uncertainty', () => {
    const result = buildResultOverview({
      groundedNarrative: narrative,
      caseSynthesis: {
        missing_information: [{
          text: 'Transferrin saturation is missing.',
          evidence: [{ type: 'biomarker', id: 'transferrin_saturation', availability: 'missing' }],
        }],
      },
    })

    assert.equal(result.missing.length, 1)
    assert.match(result.missing[0].text, /Transferrin saturation/)
  })

  it('does not crash for old or malformed reports', () => {
    assert.doesNotThrow(() => buildResultOverview())
    assert.deepEqual(buildResultOverview({ groundedNarrative: { personalized_summary: ['bad'] } }), {
      results: [], connections: [], actions: [], missing: [], consultation: [], urgent: false, source: 'legacy', symptomImpactChanged: false,
    })
  })

  it('preserves useful report-specific content for a legacy frozen report', () => {
    const result = buildResultOverview({
      knowledgeReport: {
        summary: { headline: 'Ferritin may need attention.' },
        why_it_matters: [{ title: 'Iron context', summary: 'This may be relevant to energy.' }],
        action_plan: [{ title: 'Discuss iron studies.' }],
        doctor_discussion: ['Ask whether follow-up testing is appropriate.'],
      },
      priorityMarkers: [{ name_en: 'Ferritin', value: 9, unit: 'ng/mL' }],
    })

    assert.equal(result.source, 'legacy')
    assert.match(result.results[0].text, /Ferritin may need attention/)
    assert.match(result.connections[0].text, /This may be relevant to energy/)
    assert.match(result.actions[0].text, /Discuss iron studies/)
    assert.match(result.consultation[0].text, /follow-up testing/)
  })
})
