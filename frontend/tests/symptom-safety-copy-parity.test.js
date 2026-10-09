import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SYMPTOM_SAFETY_COPY,
  SYMPTOM_SAFETY_LEVELS,
  getSymptomSafetyCopy,
} from '../src/copy/symptomSafetyCopy.js'

const locales = ['en', 'uk']

for (const locale of locales) {
  test(`${locale} has complete symptom safety copy`, () => {
    for (const level of SYMPTOM_SAFETY_LEVELS) {
      const copy = SYMPTOM_SAFETY_COPY[locale][level]
      assert.ok(copy, `${locale}.${level} is missing`)
      assert.ok(copy.title && copy.body && copy.action, `${locale}.${level} is incomplete`)
      assert.match(copy.tone, /^(critical|warning|success)$/)
      assert.deepEqual(getSymptomSafetyCopy(level, locale), copy)
    }
  })
}

test('emergency remains critical and escalatory in both locales', () => {
  for (const locale of locales) {
    const copy = getSymptomSafetyCopy('emergency', locale)
    assert.equal(copy.tone, 'critical')
    assert.match(copy.title, /emergency|екстрен/i)
    assert.match(copy.action, /local emergency|екстрен/i)
  }
})

test('urgent remains clinician-facing and escalatory in both locales', () => {
  for (const locale of locales) {
    const copy = getSymptomSafetyCopy('urgent_24h', locale)
    assert.equal(copy.tone, 'warning')
    assert.match(copy.title, /24|медичн/i)
    assert.match(copy.action, /medical|медичн/i)
  }
})

test('provider outage is technical, not routine or reassurance', () => {
  for (const locale of locales) {
    const copy = getSymptomSafetyCopy('provider_outage', locale)
    assert.equal(copy.tone, 'warning')
    assert.notEqual(copy.tone, getSymptomSafetyCopy('routine', locale).tone)
    assert.match(copy.body, /unavailable|недоступн/i)
    assert.match(copy.body, /not a medical|не медичн/i)
  }
})

test('insufficient data does not reassure and clinician review stays clinician-facing', () => {
  for (const locale of locales) {
    const insufficient = getSymptomSafetyCopy('insufficient_data', locale)
    const clinician = getSymptomSafetyCopy('clinician_review', locale)
    assert.match(insufficient.body, /not mean|не означає/i)
    assert.match(clinician.title, /medical|медичн/i)
  }
})

test('invalid state keys cannot silently resolve to another safety level', () => {
  assert.throws(() => getSymptomSafetyCopy('not_a_safety_level', 'en'), /Unknown symptom safety level/)
  assert.throws(() => getSymptomSafetyCopy('provider_outage_typo', 'uk'), /Unknown symptom safety level/)
})
