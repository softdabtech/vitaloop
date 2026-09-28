import api from '../lib/api.js'


export async function getRootConcernCatalog() {
  const { data } = await api.get('/symptom-check/catalog/root-concerns', {
    params: { locale: 'en' },
  })
  return data
}

export async function getCurrentSymptomSession() {
  const { data } = await api.get('/symptom-check/sessions/current')
  return data
}

export async function createSymptomSession(payload) {
  const { data } = await api.post('/symptom-check/sessions', {
    ...payload,
    locale: 'en',
  })
  return data
}

export async function submitInitialSymptomEvidence(sessionId, payload) {
  const { data } = await api.post(
    `/symptom-check/sessions/${sessionId}/initial-evidence`,
    payload,
  )
  return data
}

export async function submitSymptomAnswers(sessionId, payload, idempotencyKey) {
  const { data } = await api.post(
    `/symptom-check/sessions/${sessionId}/answers`,
    payload,
    { headers: { 'X-Idempotency-Key': idempotencyKey } },
  )
  return data
}

export async function skipSymptomSession(sessionId) {
  const { data } = await api.post(`/symptom-check/sessions/${sessionId}/skip`)
  return data
}

export async function abandonSymptomSession(sessionId) {
  const { data } = await api.post(`/symptom-check/sessions/${sessionId}/abandon`)
  return data
}

export async function getSymptomSessionSummary(sessionId) {
  const { data } = await api.get(`/symptom-check/sessions/${sessionId}/summary`)
  return data
}
