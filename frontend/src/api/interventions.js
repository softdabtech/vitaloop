import api from '../lib/api.js'

export async function listInterventions() {
  const { data } = await api.get('/interventions')
  return data
}

export async function completeProtocolAction(payload) {
  const { data } = await api.post('/interventions', payload)
  return data
}
